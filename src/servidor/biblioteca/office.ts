import "server-only";
import { MENSAJES_ARCHIVO } from "../../aplicacion/excel/archivo";
import { MENSAJES_BIBLIOTECA, firmaCoincide, type ExtensionOffice } from "../../aplicacion/biblioteca/reglas";
import { revisarZip } from "../excel/zip";

/**
 * DOCX, XLSX y PPTX son ZIP. Primero pasan por la revisión existente de
 * src/servidor/excel/zip.ts (estructura estricta, sin cifrado, sin ZIP64, sin
 * rutas con .., hasta 200 partes y tope REAL de 50 MB descomprimidos, que corta
 * las bombas), sin cambiarla. Después, por las reglas de la Biblioteca:
 *   - [Content_Types].xml y la parte principal del tipo (word/document.xml,
 *     xl/workbook.xml o ppt/presentation.xml): un .docx renombrado a .xlsx no pasa;
 *   - nada de macros en ninguna carpeta (vbaProject.bin, vbaData.xml);
 *   - nada de controles ActiveX ni de objetos incrustados binarios (.bin en
 *     embeddings), que pueden ejecutar programas.
 * Los mensajes de zip.ts hablan del pipeline de Excel: aquí se sustituyen por
 * los de la Biblioteca.
 */

const PRINCIPAL: Readonly<Record<ExtensionOffice, string>> = {
  docx: "word/document.xml",
  xlsx: "xl/workbook.xml",
  pptx: "ppt/presentation.xml",
};

const MACROS = new Set(["vbaproject.bin", "vbadata.xml"]);

/** null si el archivo se acepta; si no, el mensaje. */
export function revisarOffice(bytes: Uint8Array, ext: ExtensionOffice): string | null {
  if (!firmaCoincide(ext, bytes)) return MENSAJES_BIBLIOTECA.firmaNoCoincide(ext);

  const revision = revisarZip(bytes);
  if (!revision.ok) {
    return revision.mensaje === MENSAJES_ARCHIVO.macros ? MENSAJES_BIBLIOTECA.officeConMacros : MENSAJES_BIBLIOTECA.officeDanado;
  }

  const partes = revision.entradas.map((e) => e.toLowerCase());
  for (const parte of partes) {
    const nombre = parte.slice(parte.lastIndexOf("/") + 1);
    if (MACROS.has(nombre)) return MENSAJES_BIBLIOTECA.officeConMacros;
  }
  for (const parte of partes) {
    if (/(^|\/)activex\//.test(parte) || /(^|\/)embeddings\/[^/]*\.bin$/.test(parte)) return MENSAJES_BIBLIOTECA.officeConActivos;
  }
  if (!partes.includes("[content_types].xml") || !partes.includes(PRINCIPAL[ext])) return MENSAJES_BIBLIOTECA.firmaNoCoincide(ext);
  return null;
}
