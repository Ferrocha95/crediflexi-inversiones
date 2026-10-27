import { MENSAJE_DATO_SENSIBLE_GENERAL } from "./datosSensibles";
import { MENSAJE_CONTACTO_10_DIGITOS } from "./normalizar";

/**
 * Topes de largo. Son los mismos de las restricciones de la migración
 * 20261005120000_prospectos.sql (una prueba lo comprueba): la base es la que
 * manda y aquí solo se avisa antes.
 */
export const TOPE_NOMBRE = 150;
export const TOPE_COMENTARIOS = 1000;

export const MENSAJE_NOMBRE_VACIO = "Escribe el nombre del prospecto.";
export const MENSAJE_NOMBRE_LARGO = `El nombre admite hasta ${TOPE_NOMBRE} caracteres. Acórtalo y guarda de nuevo.`;
export const MENSAJE_COMENTARIOS_LARGO = `Los comentarios admiten hasta ${TOPE_COMENTARIOS} caracteres. Acórtalos y guarda de nuevo.`;
export const MENSAJE_SIN_PERMISO = "No tienes permiso para hacer esto.";
export const MENSAJE_ERROR_DESCONOCIDO =
  "No se pudo guardar el cambio. Vuelve a intentar en unos minutos; si sigue igual, avisa a quien administra el sistema.";

/** Restricción de la base -> mensaje para la persona. */
const POR_RESTRICCION: Record<string, string> = {
  prospectos_contacto_10_digitos: MENSAJE_CONTACTO_10_DIGITOS,
  prospectos_sin_datos_sensibles: MENSAJE_DATO_SENSIBLE_GENERAL,
  prospectos_nombre_largo_maximo: MENSAJE_NOMBRE_LARGO,
  prospectos_comentarios_largo_maximo: MENSAJE_COMENTARIOS_LARGO,
  prospectos_nombre_no_vacio: MENSAJE_NOMBRE_VACIO,
};

/** Error de Postgres/PostgREST -> mensaje en español. Nunca reenvía el texto técnico. */
export function mensajeDeErrorBase(error: { readonly code?: string; readonly message?: string }): string {
  if (error.code === "42501") return MENSAJE_SIN_PERMISO;
  const restriccion = Object.keys(POR_RESTRICCION).find((r) => error.message?.includes(`"${r}"`));
  return restriccion !== undefined ? POR_RESTRICCION[restriccion] : MENSAJE_ERROR_DESCONOCIDO;
}
