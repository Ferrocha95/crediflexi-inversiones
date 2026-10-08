/**
 * Lenguaje de promesa que no puede aparecer en lo que se muestra a un
 * candidato (modo reclutamiento): se redacta como cálculo o invitación, nunca
 * como promesa. "garantía" y "oferta" solo aparecen, negadas, en el aviso fijo
 * del archivo de textos, que no pasa por aquí. Sprint 5 suma: ilimitado, sin
 * límite, dinero fácil, sin esfuerzo, libertad financiera y millonario
 * (garantizado y asegurado ya entraban por garant* y asegur*).
 */
export const RE_LENGUAJE_PROMESA =
  /(?<![\p{L}\p{N}])(garant\p{L}*|asegur\p{L}*|sin riesgo|ingreso fijo|ganar[aá]s|recibir[aá]s|recibes|promesa|oferta|ilimitad\p{L}*|sin l[ií]mites?|dinero f[aá]cil|sin esfuerzo|libertad financiera|millonari\p{L}*)(?![\p{L}\p{N}])/iu;

/** La primera expresión de promesa del texto, o null si no hay. */
export function lenguajeDePromesa(texto: string): string | null {
  return RE_LENGUAJE_PROMESA.exec(texto)?.[0] ?? null;
}
