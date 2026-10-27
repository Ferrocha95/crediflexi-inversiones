import "server-only";
import ExcelJS from "exceljs";
import { MENSAJES_ARCHIVO, TOPES_IMPORTACION, type ConteoImportacion } from "../../aplicacion/excel/archivo";
import { fechaDeTextoIso } from "../../aplicacion/fecha";
import { avisosProspecto, type ContextoAvisos } from "../../aplicacion/pipeline/avisos";
import { validarProspecto } from "../../aplicacion/pipeline/entrada";
import { textoDeBusqueda } from "../../aplicacion/pipeline/filtros";
import { estatusEnPantalla, normalizarEstatus, normalizarFecha, normalizarTelefono, telefonoConFormato, type Estatus } from "../../aplicacion/pipeline/normalizar";
import { HOJA_PIPELINE } from "./pipeline";
import { revisarZip } from "./zip";

/**
 * Lee un .xlsx del pipeline y arma la vista previa: una línea por cada fila
 * del archivo, importable (con sus correcciones), con aviso o rechazada (con
 * el motivo). No guarda nada: guardar es confirmarImportacion, que vuelve a
 * validar todo.
 *
 * Antes de abrir el archivo: extensión .xlsx, tope de 4 MiB, firma ZIP y el
 * índice del ZIP (sin macros y sin pasar de 50 MB descomprimido). Al leer:
 * nunca se evalúan fórmulas (una celda con fórmula rechaza su fila); un texto
 * que empieza con =, +, - o @ NO es fórmula y se importa como texto. Se
 * normaliza con las funciones de la etapa C y cada fila queda a nombre de
 * quien importa.
 */

export interface ContextoImportacion extends ContextoAvisos {
  /** Quien importa: cada fila queda a su nombre. */
  readonly usuario: { readonly nombre: string };
}

export type EstadoFila = "importable" | "con_aviso" | "rechazada";

/** Una fila ya normalizada, en la forma que recibe validarProspecto (texto). */
export interface DatosImportados {
  readonly nombre: string;
  readonly contacto: string;
  readonly comentarios: string;
  readonly estatus: Estatus;
  /** AAAA-MM-DD o "" si no tiene. */
  readonly seguimiento: string;
}

export interface FilaAnalizada {
  /** Número de fila en Excel. */
  readonly fila: number;
  readonly estado: EstadoFila;
  /** El nombre tal como viene, para mostrarlo en la vista previa. */
  readonly nombre: string;
  readonly datos: DatosImportados | null;
  readonly correcciones: readonly string[];
  readonly avisos: readonly string[];
  readonly motivo: string | null;
}

export type Analisis =
  | { readonly ok: true; readonly hoja: string; readonly filas: readonly FilaAnalizada[]; readonly conteo: ConteoImportacion }
  | { readonly ok: false; readonly mensaje: string };

type Campo = "nombre" | "contacto" | "comentarios" | "estatus" | "seguimiento" | "ejecutivo";
const OBLIGATORIOS: readonly Campo[] = ["nombre", "contacto", "estatus"];
const CAMPOS: readonly Campo[] = ["nombre", "contacto", "comentarios", "estatus", "seguimiento", "ejecutivo"];
/** Filas en las que se busca el encabezado. */
const FILAS_PARA_ENCABEZADO = 30;
/** Día 0 de las fechas de Excel (sistema 1900, con el 29/02/1900 ficticio ya compensado). */
const DIA_CERO_EXCEL = Date.UTC(1899, 11, 30);
const MAX_SERIE_EXCEL = 2958465; // 31/12/9999

const fallo = (mensaje: string): Analisis => ({ ok: false, mensaje });

/** El valor de una celda, sin evaluar nunca una fórmula. */
type Lectura =
  | { readonly tipo: "vacia" }
  | { readonly tipo: "formula" }
  | { readonly tipo: "error"; readonly texto: string }
  | { readonly tipo: "texto"; readonly valor: string }
  | { readonly tipo: "numero"; readonly valor: number }
  | { readonly tipo: "fecha"; readonly valor: Date };

function leerCelda(celda: ExcelJS.Cell | undefined): Lectura {
  const v = celda?.value;
  if (v === null || v === undefined) return { tipo: "vacia" };
  if (typeof v === "string") return v.trim() === "" ? { tipo: "vacia" } : { tipo: "texto", valor: v };
  if (typeof v === "number") return { tipo: "numero", valor: v };
  if (typeof v === "boolean") return { tipo: "texto", valor: v ? "VERDADERO" : "FALSO" };
  if (v instanceof Date) return { tipo: "fecha", valor: v };
  if ("formula" in v || "sharedFormula" in v) return { tipo: "formula" };
  if ("error" in v) return { tipo: "error", texto: String(v.error) };
  if ("richText" in v) return textoDe(v.richText.map((t) => t.text).join(""));
  if ("text" in v) {
    const t = v.text as unknown;
    return typeof t === "string" ? textoDe(t) : textoDe(((t as { richText?: { text: string }[] }).richText ?? []).map((x) => x.text).join(""));
  }
  return { tipo: "error", texto: "valor desconocido" };
}

const textoDe = (s: string): Lectura => (s.trim() === "" ? { tipo: "vacia" } : { tipo: "texto", valor: s });

/** Texto de una lectura (números como texto); "" si está vacía. */
function comoTexto(l: Lectura): string {
  if (l.tipo === "texto") return l.valor;
  if (l.tipo === "numero") return Number.isInteger(l.valor) ? l.valor.toFixed(0) : String(l.valor);
  if (l.tipo === "fecha") return l.valor.toISOString().slice(0, 10);
  return "";
}

const etiqueta = (s: string) => textoDeBusqueda(s.trim()).toUpperCase();

/** Fila de encabezados y columna de cada campo, buscados por texto. */
function buscarEncabezados(hoja: ExcelJS.Worksheet): { fila: number; columnas: Partial<Record<Campo, number>> } | null {
  const ultima = Math.min(hoja.rowCount, FILAS_PARA_ENCABEZADO);
  for (let r = 1; r <= ultima; r++) {
    const columnas: Partial<Record<Campo, number>> = {};
    hoja.getRow(r).eachCell({ includeEmpty: false }, (celda, col) => {
      const l = leerCelda(celda);
      if (l.tipo !== "texto") return;
      const campo = CAMPOS.find((c) => c.toUpperCase() === etiqueta(l.valor));
      if (campo !== undefined && columnas[campo] === undefined) columnas[campo] = col;
    });
    if (OBLIGATORIOS.every((c) => columnas[c] !== undefined)) return { fila: r, columnas };
  }
  return null;
}

const dos = (n: number) => String(n).padStart(2, "0");
const isoUtc = (f: Date) => `${String(f.getUTCFullYear()).padStart(4, "0")}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;

export async function analizarArchivo(bytes: Uint8Array, nombreArchivo: string, ctx: ContextoImportacion): Promise<Analisis> {
  if (!/\.xlsx$/i.test(nombreArchivo.trim())) return fallo(MENSAJES_ARCHIVO.noXlsx);
  if (bytes.length > TOPES_IMPORTACION.bytes) return fallo(MENSAJES_ARCHIVO.muyGrande);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) return fallo(MENSAJES_ARCHIVO.noZip);
  const zip = revisarZip(bytes);
  if (!zip.ok) return fallo(zip.mensaje);

  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  } catch {
    return fallo(MENSAJES_ARCHIVO.ilegible);
  }
  const hoja = libro.getWorksheet(HOJA_PIPELINE) ?? libro.worksheets[0];
  if (hoja === undefined) return fallo(MENSAJES_ARCHIVO.ilegible);

  const encabezados = buscarEncabezados(hoja);
  if (encabezados === null) return fallo(MENSAJES_ARCHIVO.sinEncabezados);

  // Filas con algún valor debajo de los encabezados.
  const filas: ExcelJS.Row[] = [];
  let demasiadas = false;
  hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
    if (numero <= encabezados.fila || demasiadas) return;
    let conValor = false;
    fila.eachCell({ includeEmpty: false }, (celda) => {
      if (leerCelda(celda).tipo !== "vacia") conValor = true;
    });
    if (!conValor) return;
    if (filas.length >= TOPES_IMPORTACION.filas) demasiadas = true;
    else filas.push(fila);
  });
  if (demasiadas) return fallo(MENSAJES_ARCHIVO.demasiadasFilas);

  const telefonosDelArchivo = new Map<string, number>();
  const resultado = filas.map((fila) => {
    const r = analizarFila(fila, encabezados.columnas, ctx, telefonosDelArchivo);
    if (r.datos !== null && !telefonosDelArchivo.has(r.datos.contacto)) telefonosDelArchivo.set(r.datos.contacto, r.fila);
    return r;
  });

  const conteo: ConteoImportacion = {
    total: resultado.length,
    importables: resultado.filter((f) => f.estado === "importable").length,
    conAviso: resultado.filter((f) => f.estado === "con_aviso").length,
    rechazadas: resultado.filter((f) => f.estado === "rechazada").length,
  };
  return { ok: true, hoja: hoja.name, filas: resultado, conteo };
}

function analizarFila(
  fila: ExcelJS.Row,
  columnas: Partial<Record<Campo, number>>,
  ctx: ContextoImportacion,
  telefonosDelArchivo: ReadonlyMap<string, number>,
): FilaAnalizada {
  const leer = (c: Campo): Lectura => (columnas[c] === undefined ? { tipo: "vacia" } : leerCelda(fila.getCell(columnas[c]!)));
  const nombreVisible = comoTexto(leer("nombre"));
  const rechazo = (motivo: string): FilaAnalizada => ({
    fila: fila.number,
    estado: "rechazada",
    nombre: nombreVisible,
    datos: null,
    correcciones: [],
    avisos: [],
    motivo,
  });

  // Ninguna celda de la fila puede traer una fórmula ni un error de Excel.
  let problema: string | null = null;
  fila.eachCell({ includeEmpty: false }, (celda) => {
    if (problema !== null) return;
    const l = leerCelda(celda);
    if (l.tipo === "formula") problema = `la celda ${celda.address} tiene una fórmula`;
    else if (l.tipo === "error") problema = `la celda ${celda.address} tiene un error de Excel (${l.texto})`;
  });
  if (problema !== null) return rechazo(problema);

  const correcciones: string[] = [];

  // Contacto: número (como lo guarda Excel) o texto con espacios, guiones o +52.
  const contactoLeido = leer("contacto");
  const contactoTexto = comoTexto(contactoLeido);
  const tel = normalizarTelefono(contactoTexto);
  if (tel.ok && contactoLeido.tipo === "texto" && contactoTexto !== tel.valor) {
    correcciones.push(`El teléfono "${contactoTexto}" se corrigió a ${tel.valor}.`);
  }

  // Estatus: espacios de más, minúsculas o NO_INTERESADO.
  const estatusTexto = comoTexto(leer("estatus"));
  const est = normalizarEstatus(estatusTexto);
  if (est.ok && estatusTexto !== estatusEnPantalla(est.valor)) {
    correcciones.push(`El estatus "${estatusTexto}" se corrigió a ${estatusEnPantalla(est.valor)}.`);
  }

  // Seguimiento: fecha (Date en UTC), número de serie de Excel o texto.
  const seg = leer("seguimiento");
  let seguimiento = "";
  if (seg.tipo === "fecha") seguimiento = isoUtc(seg.valor);
  else if (seg.tipo === "numero" && Number.isInteger(seg.valor) && seg.valor >= 1 && seg.valor <= MAX_SERIE_EXCEL) {
    seguimiento = isoUtc(new Date(DIA_CERO_EXCEL + seg.valor * 86_400_000));
    correcciones.push(`El seguimiento venía como número de serie de Excel (${seg.valor}) y se leyó como ${fechaDeTextoIso(seguimiento)}.`);
  } else if (seg.tipo !== "vacia") {
    const f = normalizarFecha(comoTexto(seg));
    seguimiento = f.ok ? (f.valor ?? "") : comoTexto(seg);
  }

  // Ejecutivo: toda fila queda a nombre de quien importa.
  if (columnas.ejecutivo !== undefined) {
    const ejecutivo = comoTexto(leer("ejecutivo")).trim();
    if (ejecutivo === "") correcciones.push("Sin ejecutivo: queda a tu nombre.");
    else if (textoDeBusqueda(ejecutivo) !== textoDeBusqueda(ctx.usuario.nombre.trim())) {
      correcciones.push(`El ejecutivo "${ejecutivo}" se cambió por ti: todo lo importado queda a tu nombre.`);
    }
  }

  // Las mismas reglas que el alta en la pantalla (incluido el guardia de CLABE, RFC y CURP).
  const v = validarProspecto({
    nombre: nombreVisible,
    contacto: contactoTexto,
    comentarios: comoTexto(leer("comentarios")),
    estatus: estatusTexto,
    seguimiento,
  });
  if (!v.ok) return rechazo(Object.values(v.errores).join(" ") || v.mensaje);

  const datos: DatosImportados = {
    nombre: v.valor.nombre,
    contacto: v.valor.contacto,
    comentarios: v.valor.comentarios,
    estatus: v.valor.estatus,
    seguimiento: v.valor.seguimiento ?? "",
  };
  const avisos = avisosProspecto({ seguimiento: v.valor.seguimiento, contacto: datos.contacto }, ctx);
  const previa = telefonosDelArchivo.get(datos.contacto);
  if (previa !== undefined) {
    avisos.push(`El teléfono ${telefonoConFormato(datos.contacto)} se repite en la fila ${previa} del archivo. Se importa de todos modos.`);
  }
  return {
    fila: fila.number,
    estado: avisos.length > 0 ? "con_aviso" : "importable",
    nombre: nombreVisible,
    datos,
    correcciones,
    avisos,
    motivo: null,
  };
}
