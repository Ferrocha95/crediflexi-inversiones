import { mesDelViernes, type Semana } from "../pipeline/semana";

/**
 * Lo que comparten la exportación y la importación del Excel del pipeline
 * (docs/FORMATOS_EXCEL.md), sin depender de exceljs: nombre del archivo,
 * topes, mensajes y el resumen de la vista previa.
 */

/** Topes de la importación. Son límites de seguridad, no reglas de negocio. */
export const TOPES_IMPORTACION = {
  /** Bytes del archivo (content-length y bytes reales). */
  bytes: 5 * 1024 * 1024,
  /** Suma de los tamaños descomprimidos declarados en el índice del ZIP. */
  descomprimido: 50 * 1024 * 1024,
  /** Filas con datos debajo de los encabezados. */
  filas: 2000,
} as const;

export const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** PIPELINE_{MES}.xlsx, con el mes del viernes de la semana del encabezado. */
export function nombreArchivoPipeline(semana: Semana): string {
  return `PIPELINE_${mesDelViernes(semana)}.xlsx`;
}

/** Por qué se rechaza un archivo completo. */
export const MENSAJES_ARCHIVO = {
  noXlsx: 'El archivo debe ser un Excel .xlsx. Ábrelo en Excel, guárdalo como "Libro de Excel (.xlsx)" y vuelve a intentar.',
  muyGrande: "El archivo pesa más de 5 MB. Quita las hojas o filas que no sean del pipeline y vuelve a intentar.",
  noZip: "El archivo no tiene el formato de un .xlsx. Ábrelo en Excel, guárdalo de nuevo como .xlsx y vuelve a intentar.",
  indice: "No se pudo leer el índice del archivo .xlsx. Ábrelo en Excel, guárdalo de nuevo como .xlsx y vuelve a intentar.",
  macros: "El archivo trae macros (xl/vbaProject.bin). Por seguridad no se importan: guárdalo como .xlsx sin macros y vuelve a intentar.",
  descomprimido: "Al descomprimirse, el archivo pasaría de 50 MB. Revisa que sea el pipeline y vuelve a intentar.",
  ilegible: "No se pudo leer el archivo como Excel. Ábrelo en Excel, guárdalo de nuevo como .xlsx y vuelve a intentar.",
  sinEncabezados:
    "No se encontró la fila de encabezados. Debe tener las columnas NOMBRE, CONTACTO y ESTATUS (y, si quieres, COMENTARIOS, SEGUIMIENTO y EJECUTIVO).",
  demasiadasFilas: "El archivo tiene más de 2,000 filas de prospectos. Divídelo en varios archivos y vuelve a intentar.",
} as const;

/** Errores de las rutas del Excel. */
export const MENSAJES_EXCEL = {
  origenAjeno: "La petición no viene de esta misma página. Abre el pipeline desde la dirección de la app e importa desde ahí.",
  incompleto: "El archivo llegó incompleto. Vuelve a intentar; si sigue pasando, revisa que pese menos de 5 MB.",
  eligeEjecutivo: "Elige un ejecutivo en el filtro Ejecutivo para descargar su Excel: cada archivo lleva a un solo ejecutivo.",
  soloElPropio: "Solo puedes descargar tu propio pipeline.",
  ejecutivoNoVisible: "No encontramos a ese ejecutivo en tu equipo. Recarga la página y elige otro.",
  fallaLectura: "No se pudo leer el pipeline. Revisa que Supabase local esté corriendo y vuelve a intentar.",
} as const;

export interface ConteoImportacion {
  readonly total: number;
  readonly importables: number;
  readonly conAviso: number;
  readonly rechazadas: number;
}

const filas = (n: number) => (n === 1 ? "1 fila" : `${n} filas`);
const verbo = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

/** "8 filas: 3 se importan, 3 se importan con aviso y 2 no se importan." */
export function resumenImportacion(c: ConteoImportacion): string {
  if (c.total === 0) return "El archivo no tiene filas de prospectos debajo de los encabezados.";
  const partes = [
    c.importables > 0 ? verbo(c.importables, "se importa", "se importan") : null,
    c.conAviso > 0 ? verbo(c.conAviso, "se importa con aviso", "se importan con aviso") : null,
    c.rechazadas > 0 ? verbo(c.rechazadas, "no se importa", "no se importan") : null,
  ].filter((p): p is string => p !== null);
  const lista = partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
  return `${filas(c.total)}: ${lista}.`;
}
