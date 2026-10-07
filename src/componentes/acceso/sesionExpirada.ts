import { MENSAJE_SESION_EXPIRADA } from "./textos";

/**
 * true si una acción del servidor falló porque el proxy respondió 401: Next
 * convierte esa respuesta (text/plain, código 400 o más) en un Error con el
 * mismo texto.
 */
export function errorEsSesionExpirada(error: unknown): boolean {
  return error instanceof Error && error.message === MENSAJE_SESION_EXPIRADA;
}

/** true si la acción de vista previa respondió que no hay usuario activo. */
export function vistaPreviaSinSesion(resultado: { readonly tipo: string; readonly mensaje?: string }): boolean {
  return resultado.tipo === "error" && resultado.mensaje === MENSAJE_SESION_EXPIRADA;
}
