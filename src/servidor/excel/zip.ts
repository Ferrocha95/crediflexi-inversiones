import "server-only";
import { MENSAJES_ARCHIVO, TOPES_IMPORTACION } from "../../aplicacion/excel/archivo";

/**
 * Lee el índice (directorio central) de un .xlsx, que es un ZIP, ANTES de
 * entregárselo a exceljs, sin dependencias: solo los encabezados del final
 * del archivo, sin descomprimir nada.
 *
 * Rechaza:
 *   - un archivo con macros (la entrada xl/vbaProject.bin);
 *   - una suma de tamaños descomprimidos declarados de más de 50 MB (bomba ZIP);
 *   - ZIP64 o un índice que no cuadra.
 *
 * Ojo: los tamaños son los que el archivo DECLARA y pueden falsearse
 * (PENDIENTES_TECNICOS.md). El tope de 5 MB del archivo y los permisos limitan
 * el daño, no lo eliminan.
 */

const FIRMA_FIN = 0x06054b50; // End of central directory
const FIRMA_CENTRAL = 0x02014b50; // Central directory file header
const LARGO_FIN = 22;
const LARGO_CENTRAL = 46;
const MAX_COMENTARIO = 0xffff;
const MACROS = "xl/vbaproject.bin";

export type RevisionZip =
  | { readonly ok: true; readonly entradas: readonly string[]; readonly descomprimido: number }
  | { readonly ok: false; readonly mensaje: string };

const fallo = (mensaje: string): RevisionZip => ({ ok: false, mensaje });

export function revisarZip(bytes: Uint8Array): RevisionZip {
  if (bytes.length < LARGO_FIN) return fallo(MENSAJES_ARCHIVO.indice);
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // El registro final está en los últimos 22 bytes, más un comentario opcional.
  let fin = -1;
  for (let i = bytes.length - LARGO_FIN; i >= Math.max(0, bytes.length - LARGO_FIN - MAX_COMENTARIO); i--) {
    if (vista.getUint32(i, true) === FIRMA_FIN && i + LARGO_FIN + vista.getUint16(i + 20, true) === bytes.length) {
      fin = i;
      break;
    }
  }
  if (fin < 0) return fallo(MENSAJES_ARCHIVO.indice);

  const total = vista.getUint16(fin + 10, true);
  const tamanoIndice = vista.getUint32(fin + 12, true);
  const inicioIndice = vista.getUint32(fin + 16, true);
  // ZIP64 (valores en 0xFFFF o 0xFFFFFFFF) no se admite: un .xlsx de 5 MB no lo necesita.
  if (total === 0xffff || tamanoIndice === 0xffffffff || inicioIndice === 0xffffffff) return fallo(MENSAJES_ARCHIVO.indice);
  if (inicioIndice + tamanoIndice > fin) return fallo(MENSAJES_ARCHIVO.indice);

  const entradas: string[] = [];
  let descomprimido = 0;
  let p = inicioIndice;
  for (let n = 0; n < total; n++) {
    if (p + LARGO_CENTRAL > fin || vista.getUint32(p, true) !== FIRMA_CENTRAL) return fallo(MENSAJES_ARCHIVO.indice);
    const tamano = vista.getUint32(p + 24, true);
    const largoNombre = vista.getUint16(p + 28, true);
    const largoExtra = vista.getUint16(p + 30, true);
    const largoComentario = vista.getUint16(p + 32, true);
    const finNombre = p + LARGO_CENTRAL + largoNombre;
    if (finNombre > fin) return fallo(MENSAJES_ARCHIVO.indice);
    const nombre = new TextDecoder().decode(bytes.subarray(p + LARGO_CENTRAL, finNombre));
    if (nombre.toLowerCase() === MACROS) return fallo(MENSAJES_ARCHIVO.macros);
    descomprimido += tamano;
    if (descomprimido > TOPES_IMPORTACION.descomprimido) return fallo(MENSAJES_ARCHIVO.descomprimido);
    entradas.push(nombre);
    p = finNombre + largoExtra + largoComentario;
  }
  return { ok: true, entradas, descomprimido };
}
