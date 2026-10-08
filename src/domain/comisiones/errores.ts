/**
 * Errores del motor de comisiones. Van aparte de los del cotizador
 * (src/domain/comun/errores.ts) para no mezclar los dos motores. Cada mensaje
 * dice, en español claro, qué falló y qué hacer.
 */
export type CodigoComision =
  | "SEMILLA_COMISIONES_INVALIDA"
  | "ENTRADA_INVALIDA"
  | "MONTO_INVALIDO"
  | "MONTO_MENOR_AL_MINIMO"
  | "PLAZO_INVALIDO"
  | "MONEDA_SIN_COMISION"
  | "FECHA_INVALIDA"
  | "MESES_MEZCLADOS";

export interface ErrorComision {
  readonly codigo: CodigoComision;
  readonly mensaje: string;
  /** Lista opcional de problemas puntuales (por ejemplo, cada error de la semilla). */
  readonly detalles?: readonly string[];
}

export type ResultadoComision<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly error: ErrorComision };

export function exitoComision<T>(valor: T): ResultadoComision<T> {
  return { ok: true, valor };
}

export function falloComision<T>(codigo: CodigoComision, mensaje: string, detalles?: readonly string[]): ResultadoComision<T> {
  return { ok: false, error: detalles === undefined ? { codigo, mensaje } : { codigo, mensaje, detalles } };
}
