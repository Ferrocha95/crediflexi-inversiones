import { error, ok, type ResultadoApp } from "./resultado";

/** Mensaje de la pantalla cuando el formato del monto no se entiende. */
export const MENSAJE_MONTO_ILEGIBLE = "Escribe el monto como 150,000.50 o 150000.50";

/**
 * "$" opcional, entero sin comas o con comas de miles bien agrupadas (el primer
 * grupo no empieza con 0) y hasta 2 decimales con punto.
 */
const RE_MONTO_PANTALLA = /^\$?\s*([1-9]\d{0,2}(?:,\d{3})+|\d+)(\.\d{1,2})?$/;

/**
 * Convierte el monto tal como se escribe en la pantalla ("$1,500,000.50") al
 * texto que recibe el dominio ("1500000.50"). Solo cambia la forma: que el
 * monto sea mayor que cero o esté dentro de la tabla lo decide cotizar.
 */
export function normalizarMonto(texto: string): ResultadoApp<string> {
  const m = RE_MONTO_PANTALLA.exec(texto.trim());
  if (m === null) return error("MONTO_ILEGIBLE", MENSAJE_MONTO_ILEGIBLE);
  return ok(m[1].replaceAll(",", "") + (m[2] ?? ""));
}
