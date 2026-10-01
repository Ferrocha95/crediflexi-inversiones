/**
 * Errores tipados del dominio. Cada mensaje dice, en español claro, qué falló
 * y qué hacer.
 */
export type CodigoError =
  | "SEMILLA_INVALIDA"
  | "MONEDA_SIN_TABLA"
  | "ENTIDAD_SIN_TABLA"
  | "TABLA_POR_CONFIRMAR"
  | "TRAMO_POR_CONFIRMAR"
  | "MONTO_INVALIDO"
  | "MONTO_FUERA_DE_RANGO"
  | "PLAZO_NO_DISPONIBLE";

export interface ErrorCotizacion {
  readonly codigo: CodigoError;
  readonly mensaje: string;
  /** Lista opcional de problemas puntuales (por ejemplo, cada error de la semilla). */
  readonly detalles?: readonly string[];
}

export function crearError(
  codigo: CodigoError,
  mensaje: string,
  detalles?: readonly string[],
): ErrorCotizacion {
  return detalles === undefined ? { codigo, mensaje } : { codigo, mensaje, detalles };
}
