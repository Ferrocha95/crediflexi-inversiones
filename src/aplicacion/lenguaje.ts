/**
 * Lenguaje de promesa que no puede aparecer en lo que se muestra a un
 * candidato (modo reclutamiento): se redacta como cálculo, nunca como promesa.
 * "garantía" y "oferta" solo aparecen, negadas, en el aviso fijo del archivo de
 * textos, que no pasa por aquí.
 */
export const RE_LENGUAJE_PROMESA =
  /(?<![\p{L}\p{N}])(garant\p{L}*|asegur\p{L}*|sin riesgo|ingreso fijo|ganar[aá]s|recibir[aá]s|recibes|promesa|oferta)(?![\p{L}\p{N}])/iu;

/** La primera expresión de promesa del texto, o null si no hay. */
export function lenguajeDePromesa(texto: string): string | null {
  return RE_LENGUAJE_PROMESA.exec(texto)?.[0] ?? null;
}
