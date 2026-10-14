import "server-only";
import {
  MENSAJES_BIBLIOTECA,
  TIPOS,
  esOffice,
  firmaCoincide,
  limpiarNombreArchivo,
  revisarTamano,
  tipoPorNombre,
  type Extension,
} from "../../aplicacion/biblioteca/reglas";
import { revisarOffice } from "./office";

export type ResultadoArchivo =
  | { readonly ok: true; readonly ext: Extension; readonly mime: string; readonly nombreLimpio: string }
  | { readonly ok: false; readonly mensaje: string; readonly muyGrande: boolean };

/**
 * Revisión completa de un archivo recibido: nombre limpio, extensión
 * permitida, tamaño REAL (bytes recibidos, no lo que declara el navegador) y
 * primeros bytes; DOCX, XLSX y PPTX además con la revisión del ZIP. El tipo que
 * se guarda sale de aquí, nunca del navegador.
 */
export function validarArchivo(nombreOriginal: string, bytes: Uint8Array): ResultadoArchivo {
  const nombreLimpio = limpiarNombreArchivo(nombreOriginal);
  const tipo = tipoPorNombre(nombreLimpio);
  if (!tipo.ok) return { ok: false, mensaje: tipo.mensaje, muyGrande: false };

  const tamano = revisarTamano(bytes.length);
  if (tamano !== null) return { ok: false, mensaje: tamano, muyGrande: tamano === MENSAJES_BIBLIOTECA.muyGrande };

  const ext = tipo.ext;
  const firma = esOffice(ext) ? revisarOffice(bytes, ext) : firmaCoincide(ext, bytes) ? null : MENSAJES_BIBLIOTECA.firmaNoCoincide(ext);
  if (firma !== null) return { ok: false, mensaje: firma, muyGrande: false };

  return { ok: true, ext, mime: TIPOS[ext].mime, nombreLimpio };
}
