import "server-only";
import { inflateRawSync } from "node:zlib";
import { MENSAJES_ARCHIVO, TOPES_IMPORTACION } from "../../aplicacion/excel/archivo";

/**
 * Revisa un .xlsx (que es un ZIP) ANTES de entregárselo a ExcelJS, sin
 * dependencias (solo node:zlib). ExcelJS recibe después el buffer original,
 * ya revisado.
 *
 * 1. Estructura estricta, para que este lector y el de ExcelJS no puedan ver
 *    archivos distintos: un solo registro de fin, al final exacto del
 *    archivo y sin comentario; directorio central contiguo con el número de
 *    entradas declarado; cada encabezado local igual a su entrada del
 *    directorio (nombre y método); entradas contiguas, sin datos sueltos.
 * 2. Nunca se admiten: ZIP64, entradas cifradas, métodos distintos de
 *    "guardado" (0) o deflate (8), rutas que empiecen con / o \ o que
 *    contengan .., nombres repetidos, más de 200 entradas ni macros
 *    (xl/vbaProject.bin).
 * 3. Tope REAL de 50 MB descomprimidos: cada entrada se descomprime aquí con
 *    inflateRawSync y maxOutputLength igual al presupuesto que queda, así que
 *    una bomba se corta al llegar al tope. El tamaño real de cada entrada
 *    debe coincidir con el declarado.
 *
 * Lo que sigue sin cubrir (PENDIENTES_TECNICOS.md): el CPU que ExcelJS gasta
 * al leer hojas muy grandes y cualquier otra diferencia entre lectores.
 */

export const MAX_ENTRADAS = 200;

export const MENSAJES_ZIP = {
  finConDatos:
    "El archivo trae datos pegados después del final del ZIP, algo que Excel no escribe. Por seguridad no se importa: ábrelo en Excel, guárdalo de nuevo como .xlsx y vuelve a intentar.",
  comentario:
    "El archivo trae un comentario en el índice del ZIP, algo que Excel no escribe. Por seguridad no se importa: guárdalo de nuevo desde Excel como .xlsx y vuelve a intentar.",
  variosFines:
    "El archivo trae más de un registro de fin del índice del ZIP. Por seguridad no se importa: guárdalo de nuevo desde Excel como .xlsx y vuelve a intentar.",
  zip64: "El archivo usa el formato ZIP64, que un .xlsx de hasta 4 MB no necesita. Guárdalo de nuevo desde Excel como .xlsx y vuelve a intentar.",
  demasiadasEntradas: `El archivo trae más de ${MAX_ENTRADAS} partes internas; un pipeline tiene muchas menos. Revisa que sea el archivo correcto.`,
  conteoEntradas:
    "El número de partes que declara el índice del ZIP no coincide con las que trae. El archivo está dañado o alterado: guárdalo de nuevo desde Excel.",
  cifrada: "El archivo trae partes cifradas (protegidas con contraseña). Quítale la contraseña en Excel, guárdalo y vuelve a intentar.",
  metodo: "El archivo usa un método de compresión que no se admite. Guárdalo de nuevo desde Excel como .xlsx y vuelve a intentar.",
  rutaNoPermitida:
    "El archivo trae una parte con una ruta no permitida (empieza con / o \\, o contiene ..). Por seguridad no se importa.",
  duplicada: "El archivo trae dos partes con el mismo nombre. Está alterado: guárdalo de nuevo desde Excel como .xlsx.",
  localNoCoincide:
    "Un encabezado interno del ZIP no coincide con su índice. El archivo está dañado o alterado: guárdalo de nuevo desde Excel.",
  datosSueltos:
    "El archivo trae datos que no pertenecen a ninguna parte del ZIP. Por seguridad no se importa: guárdalo de nuevo desde Excel como .xlsx.",
  tamanoNoCoincide:
    "El tamaño real de una parte del archivo no coincide con el que declara. El archivo está dañado o alterado: guárdalo de nuevo desde Excel.",
  danado: "Una parte del archivo no se pudo descomprimir: está dañada. Guárdalo de nuevo desde Excel como .xlsx y vuelve a intentar.",
} as const;

const FIRMA_LOCAL = 0x04034b50;
const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_FIN = 0x06054b50;
const FIRMA_LOCALIZADOR_ZIP64 = 0x07064b50;
const FIRMA_DESCRIPTOR = 0x08074b50;
const LARGO_LOCAL = 30;
const LARGO_CENTRAL = 46;
const LARGO_FIN = 22;
const LARGO_LOCALIZADOR_ZIP64 = 20;
const MAX_COMENTARIO = 0xffff;
const ID_EXTRA_ZIP64 = 0x0001;
const BANDERA_CIFRADO = 0x0001;
const BANDERA_DESCRIPTOR = 0x0008;
const GUARDADO = 0;
const DEFLATE = 8;
const MACROS = "xl/vbaproject.bin";

export type RevisionZip =
  | { readonly ok: true; readonly entradas: readonly string[]; readonly descomprimido: number }
  | { readonly ok: false; readonly mensaje: string };

const fallo = (mensaje: string): RevisionZip => ({ ok: false, mensaje });

interface Entrada {
  readonly nombre: string;
  readonly nombreBytes: Uint8Array;
  readonly banderas: number;
  readonly metodo: number;
  readonly comprimido: number;
  readonly declarado: number;
  readonly desplazamiento: number;
}

/** Un rechazo con su mensaje; se lanza dentro de revisarZip y se convierte en { ok: false }. */
class Rechazo extends Error {}
const rechazar = (mensaje: string): never => {
  throw new Rechazo(mensaje);
};

const iguales = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/** ¿Trae el campo extra de ZIP64 (id 0x0001)? */
function tieneExtraZip64(vista: DataView, inicio: number, largo: number): boolean {
  for (let p = inicio; p + 4 <= inicio + largo; ) {
    if (vista.getUint16(p, true) === ID_EXTRA_ZIP64) return true;
    p += 4 + vista.getUint16(p + 2, true);
  }
  return false;
}

const rutaNoPermitida = (nombre: string) => nombre.startsWith("/") || nombre.startsWith("\\") || nombre.includes("..");

export function revisarZip(bytes: Uint8Array): RevisionZip {
  try {
    return revisar(bytes);
  } catch (e) {
    if (e instanceof Rechazo) return fallo(e.message);
    // Cualquier lectura fuera de rango (DataView) es un índice que no cuadra.
    if (e instanceof RangeError) return fallo(MENSAJES_ARCHIVO.indice);
    throw e;
  }
}

function revisar(bytes: Uint8Array): RevisionZip {
  if (bytes.length < LARGO_FIN) return fallo(MENSAJES_ARCHIVO.indice);
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (p: number) => vista.getUint16(p, true);
  const u32 = (p: number) => vista.getUint32(p, true);

  // 1. El registro de fin: se busca desde el final, como lo hacen los lectores de ZIP.
  let fin = -1;
  for (let i = bytes.length - LARGO_FIN; i >= Math.max(0, bytes.length - LARGO_FIN - MAX_COMENTARIO); i--) {
    if (u32(i) === FIRMA_FIN) {
      fin = i;
      break;
    }
  }
  if (fin < 0) return fallo(MENSAJES_ARCHIVO.indice);
  const largoComentario = u16(fin + 20);
  if (fin + LARGO_FIN + largoComentario !== bytes.length) return fallo(MENSAJES_ZIP.finConDatos);
  if (largoComentario > 0) return fallo(MENSAJES_ZIP.comentario);

  const disco = u16(fin + 4);
  const discoIndice = u16(fin + 6);
  const enDisco = u16(fin + 8);
  const total = u16(fin + 10);
  const tamanoIndice = u32(fin + 12);
  const inicioIndice = u32(fin + 16);
  const localizadorZip64 = fin >= LARGO_LOCALIZADOR_ZIP64 && u32(fin - LARGO_LOCALIZADOR_ZIP64) === FIRMA_LOCALIZADOR_ZIP64;
  if (localizadorZip64 || [disco, discoIndice, enDisco, total].includes(0xffff) || [tamanoIndice, inicioIndice].includes(0xffffffff)) {
    return fallo(MENSAJES_ZIP.zip64);
  }
  if (disco !== 0 || discoIndice !== 0) return fallo(MENSAJES_ARCHIVO.indice);
  if (enDisco !== total) return fallo(MENSAJES_ZIP.conteoEntradas);
  if (total > MAX_ENTRADAS) return fallo(MENSAJES_ZIP.demasiadasEntradas);

  // Entre el final del directorio y el registro de fin no puede haber nada (y menos otro registro de fin).
  const finIndice = inicioIndice + tamanoIndice;
  if (finIndice > fin) return fallo(MENSAJES_ARCHIVO.indice);
  if (finIndice < fin) {
    for (let i = finIndice; i + 4 <= fin; i++) if (u32(i) === FIRMA_FIN) return fallo(MENSAJES_ZIP.variosFines);
    return fallo(MENSAJES_ZIP.datosSueltos);
  }

  // 2. El directorio central, entrada por entrada.
  const entradas: Entrada[] = [];
  const vistos = new Set<string>();
  let p = inicioIndice;
  while (p < finIndice) {
    if (p + LARGO_CENTRAL > finIndice || u32(p) !== FIRMA_CENTRAL) return fallo(MENSAJES_ZIP.conteoEntradas);
    const banderas = u16(p + 8);
    const metodo = u16(p + 10);
    const comprimido = u32(p + 20);
    const declarado = u32(p + 24);
    const largoNombre = u16(p + 28);
    const largoExtra = u16(p + 30);
    const largoComentarioEntrada = u16(p + 32);
    const desplazamiento = u32(p + 42);
    const siguiente = p + LARGO_CENTRAL + largoNombre + largoExtra + largoComentarioEntrada;
    if (siguiente > finIndice) return fallo(MENSAJES_ZIP.conteoEntradas);

    if ([comprimido, declarado, desplazamiento].includes(0xffffffff) || tieneExtraZip64(vista, p + LARGO_CENTRAL + largoNombre, largoExtra)) {
      return fallo(MENSAJES_ZIP.zip64);
    }
    if (banderas & BANDERA_CIFRADO) return fallo(MENSAJES_ZIP.cifrada);
    if (metodo !== GUARDADO && metodo !== DEFLATE) return fallo(MENSAJES_ZIP.metodo);

    const nombreBytes = bytes.subarray(p + LARGO_CENTRAL, p + LARGO_CENTRAL + largoNombre);
    const nombre = new TextDecoder().decode(nombreBytes);
    if (rutaNoPermitida(nombre)) return fallo(MENSAJES_ZIP.rutaNoPermitida);
    const clave = nombre.toLowerCase();
    if (vistos.has(clave)) return fallo(MENSAJES_ZIP.duplicada);
    vistos.add(clave);
    if (clave === MACROS) return fallo(MENSAJES_ARCHIVO.macros);

    entradas.push({ nombre, nombreBytes, banderas, metodo, comprimido, declarado, desplazamiento });
    p = siguiente;
  }
  if (p !== finIndice || entradas.length !== total) return fallo(MENSAJES_ZIP.conteoEntradas);

  // Tope sobre lo declarado: rechaza antes de descomprimir nada.
  const declaradoTotal = entradas.reduce((s, e) => s + e.declarado, 0);
  if (declaradoTotal > TOPES_IMPORTACION.descomprimido) return fallo(MENSAJES_ARCHIVO.descomprimido);

  // 3. Encabezados locales: iguales al directorio y contiguos desde el byte 0 hasta el directorio.
  const datos: { entrada: Entrada; inicio: number }[] = [];
  const zonasDeDatos: [number, number][] = [];
  let cursor = 0;
  for (const e of [...entradas].sort((a, b) => a.desplazamiento - b.desplazamiento)) {
    if (e.desplazamiento !== cursor) return fallo(MENSAJES_ZIP.datosSueltos);
    if (cursor + LARGO_LOCAL > inicioIndice || u32(cursor) !== FIRMA_LOCAL) return fallo(MENSAJES_ZIP.localNoCoincide);
    const banderasLocal = u16(cursor + 6);
    const metodoLocal = u16(cursor + 8);
    const largoNombre = u16(cursor + 26);
    const largoExtra = u16(cursor + 28);
    const nombreLocal = bytes.subarray(cursor + LARGO_LOCAL, cursor + LARGO_LOCAL + largoNombre);
    if (metodoLocal !== e.metodo || !iguales(nombreLocal, e.nombreBytes)) return fallo(MENSAJES_ZIP.localNoCoincide);
    if (banderasLocal & BANDERA_CIFRADO) return fallo(MENSAJES_ZIP.cifrada);
    if (tieneExtraZip64(vista, cursor + LARGO_LOCAL + largoNombre, largoExtra)) return fallo(MENSAJES_ZIP.zip64);

    const inicio = cursor + LARGO_LOCAL + largoNombre + largoExtra;
    cursor = inicio + e.comprimido;
    if (cursor > inicioIndice) return fallo(MENSAJES_ZIP.datosSueltos);
    datos.push({ entrada: e, inicio });
    zonasDeDatos.push([inicio, cursor]);

    // Descriptor de datos opcional (bandera 3): 12 bytes, o 16 con su firma.
    if (e.banderas & BANDERA_DESCRIPTOR || banderasLocal & BANDERA_DESCRIPTOR) {
      cursor += cursor + 4 <= inicioIndice && u32(cursor) === FIRMA_DESCRIPTOR ? 16 : 12;
      if (cursor > inicioIndice) return fallo(MENSAJES_ZIP.datosSueltos);
    }
  }
  if (cursor !== inicioIndice) return fallo(MENSAJES_ZIP.datosSueltos);

  // Ningún otro registro de fin fuera de los datos de las entradas (encabezados y directorio).
  for (let i = 0; i + 4 <= fin; i++) {
    const zona = zonasDeDatos.find(([a, b]) => i >= a && i < b);
    if (zona !== undefined) {
      i = zona[1] - 1;
      continue;
    }
    if (u32(i) === FIRMA_FIN) return fallo(MENSAJES_ZIP.variosFines);
  }

  // 4. Tope REAL: cada entrada se descomprime con el presupuesto que queda.
  let real = 0;
  for (const { entrada: e, inicio } of datos) {
    const restante = TOPES_IMPORTACION.descomprimido - real;
    const contenido = bytes.subarray(inicio, inicio + e.comprimido);
    let tamano: number;
    if (e.metodo === GUARDADO) {
      tamano = contenido.length;
      if (tamano > restante) return fallo(MENSAJES_ARCHIVO.descomprimido);
    } else {
      try {
        // maxOutputLength debe ser al menos 1; si el presupuesto es 0, cualquier byte lo rebasa.
        tamano = inflateRawSync(contenido, { maxOutputLength: Math.max(1, restante) }).length;
      } catch (err) {
        const codigo = (err as { code?: string }).code;
        if (err instanceof RangeError || codigo === "ERR_BUFFER_TOO_LARGE") return fallo(MENSAJES_ARCHIVO.descomprimido);
        return fallo(MENSAJES_ZIP.danado);
      }
      if (tamano > restante) return fallo(MENSAJES_ARCHIVO.descomprimido);
    }
    if (tamano !== e.declarado) return fallo(MENSAJES_ZIP.tamanoNoCoincide);
    real += tamano;
  }

  return { ok: true, entradas: entradas.map((e) => e.nombre), descomprimido: real };
}
