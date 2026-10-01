/**
 * Caracteres que no deben llegar al PDF: los de control (C0, DEL y C1, que
 * incluyen saltos de línea y tabuladores), los separadores de línea y de
 * párrafo de Unicode y los invisibles de formato (guion suave, espacios de
 * ancho cero, marcas y controles de dirección del texto, BOM).
 */
const RE_CONTROL = /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u2028-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]+/g;

/**
 * Limpia un campo de texto libre: cambia cada tramo de caracteres de control
 * por un espacio, quita espacios dobles, recorta los extremos y corta al tope
 * (en caracteres, sin partir emojis ni letras fuera del plano básico).
 */
export function limpiarCampo(texto: string, tope: number): string {
  const limpio = texto.replace(RE_CONTROL, " ").replace(/ {2,}/g, " ").trim();
  return Array.from(limpio).slice(0, tope).join("").trimEnd();
}
