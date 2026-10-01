import type { Decimal } from "./decimal";
import { ROUND_HALF_UP } from "./decimal";

function conMiles(monto: Decimal): string {
  const [entero, centavos] = monto.abs().toFixed(2, ROUND_HALF_UP).split(".");
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${centavos}`;
}

function signo(monto: Decimal): string {
  return monto.isNegative() && !monto.isZero() ? "-" : "";
}

/** "1,500,000.00": como formatearPesos, sin el signo de pesos (para los desgloses). */
export function formatearCantidad(monto: Decimal): string {
  return `${signo(monto)}${conMiles(monto)}`;
}

/** "$1,500,000.00": 2 decimales, mitad hacia arriba, comas de miles. */
export function formatearPesos(monto: Decimal): string {
  return `${signo(monto)}$${conMiles(monto)}`;
}

/** "$1,500,000.00 MXN" */
export function formatearMonto(monto: Decimal, moneda: string): string {
  return `${formatearPesos(monto)} ${moneda}`;
}

/** [6, 12, 18, 24] -> "6, 12, 18 y 24" */
export function listaEnEspanol(elementos: readonly (string | number)[]): string {
  const textos = elementos.map(String);
  if (textos.length <= 1) return textos.join("");
  return `${textos.slice(0, -1).join(", ")} y ${textos[textos.length - 1]}`;
}
