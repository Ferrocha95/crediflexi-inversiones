import type { Decimal } from "../comun/decimal";
import { formatearCantidad } from "../comun/formato";
import type { Salida } from "../tasas/semilla.esquema";
import { aCentavos } from "./redondeo";

/** Meses del año: divisor de la tasa anual en interés simple (no es un parámetro de negocio). */
const MESES_POR_ANIO = 12;

export interface Cifra {
  /** Valor sin redondear (una sola división, precisión del Decimal del dominio). */
  readonly exacto: Decimal;
  /** aCentavos(exacto). */
  readonly redondeado: Decimal;
  readonly desglose: { readonly formula: string; readonly operacion: string };
}

export type Rendimientos = Readonly<Record<Salida, Cifra>>;

function cifra(exacto: Decimal, formula: string, factores: readonly string[], divisor: number | null): Cifra {
  const redondeado = aCentavos(exacto);
  const operacion =
    factores.join(" × ") + (divisor === null ? "" : ` ÷ ${divisor}`) + ` = ${formatearCantidad(redondeado)}`;
  return { exacto, redondeado, desglose: { formula, operacion } };
}

/**
 * Interés simple sobre la tasa anual. Siempre se multiplica antes de dividir y
 * hay como máximo una división entre 12:
 *   mensual = monto × tasa ÷ 12
 *   anual   = monto × tasa              (equivalente a 12 meses)
 *   total   = monto × tasa × plazo ÷ 12
 * Cada salida se redondea desde su propio valor exacto.
 */
export function calcularRendimientos(monto: Decimal, tasa: Decimal, plazo: number): Rendimientos {
  const montoPorTasa = monto.times(tasa);
  const m = formatearCantidad(monto);
  const t = tasa.toString();

  return {
    rendimiento_mensual_pesos: cifra(
      montoPorTasa.div(MESES_POR_ANIO),
      `monto × tasa anual ÷ ${MESES_POR_ANIO}`,
      [m, t],
      MESES_POR_ANIO,
    ),
    rendimiento_anual_pesos: cifra(montoPorTasa, "monto × tasa anual", [m, t], null),
    ganancia_total_plazo: cifra(
      montoPorTasa.times(plazo).div(MESES_POR_ANIO),
      `monto × tasa anual × plazo ÷ ${MESES_POR_ANIO}`,
      [m, t, String(plazo)],
      MESES_POR_ANIO,
    ),
  };
}
