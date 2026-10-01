import { ROUND_HALF_UP, type Decimal } from "../comun/decimal";

/**
 * 2 decimales, mitad hacia arriba. Recibe siempre el valor EXACTO de una
 * salida: cada salida se redondea una sola vez y nunca desde otra ya redondeada.
 */
export function aCentavos(exacto: Decimal): Decimal {
  return exacto.toDecimalPlaces(2, ROUND_HALF_UP);
}

/**
 * Pesos enteros, mitad hacia arriba (512.50 -> 513). Solo para comparar con las
 * cifras del pptx, que vienen en pesos enteros; la app guarda y muestra centavos.
 */
export function aPesosEnteros(exacto: Decimal): Decimal {
  return exacto.toDecimalPlaces(0, ROUND_HALF_UP);
}
