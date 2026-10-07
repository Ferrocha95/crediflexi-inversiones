import type { Decimal } from "../domain/comun/decimal";
import { formatearPesos } from "../domain/comun/formato";
import type { Moneda } from "../domain/tasas/semilla.esquema";

/**
 * Importe para la pantalla y el PDF: "$23,750.00" en pesos (la moneda de
 * siempre) y "$70.83 USD" en dólares, para que una cifra en dólares nunca se
 * confunda con pesos. Las marcas de los ejes de las gráficas no lo usan: van
 * junto a tarjetas que ya dicen la moneda.
 */
export function formatearDinero(monto: Decimal, moneda: Moneda): string {
  return moneda === "MXN" ? formatearPesos(monto) : `${formatearPesos(monto)} ${moneda}`;
}
