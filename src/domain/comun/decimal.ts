import DecimalJs from "decimal.js";

/**
 * Constructor de Decimal propio del dominio. Es un clon: no toca la
 * configuración global de decimal.js.
 *
 * - precision: dígitos significativos de las operaciones intermedias. Con 40
 *   sobra para montos de billones con centavos y divisiones periódicas (÷ 12).
 * - rounding: mitad hacia arriba (en decimal.js, ROUND_HALF_UP redondea al más
 *   cercano y, en empate, lejos de cero; para montos positivos es "mitad hacia
 *   arriba").
 */
export const Decimal = DecimalJs.clone({
  precision: 40,
  rounding: DecimalJs.ROUND_HALF_UP,
});

export type Decimal = DecimalJs;

export const ROUND_HALF_UP = DecimalJs.ROUND_HALF_UP;
