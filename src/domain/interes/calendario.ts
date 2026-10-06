import { Decimal } from "../comun/decimal";
import { exito, fallo, type Resultado } from "../comun/resultado";
import type { SolicitudTasa } from "../tasas/resolver";
import type { Esquema, Semilla } from "../tasas/semilla.esquema";
import { cotizar } from "./cotizar";
import { aCentavos } from "./redondeo";

/** Meses del año: divisor de la tasa anual en interés simple (no es un parámetro de negocio). */
const MESES_POR_ANIO = 12;

/** Un mes del calendario. Cifras como texto decimal con 2 decimales. */
export interface FilaCalendario {
  /** 1 a plazo. Los meses se identifican solo por número, sin fechas. */
  readonly mes: number;
  readonly rendimiento: string;
  readonly acumulado: string;
}

/** Calendario de una modalidad, con las cifras de su tarjeta en la página 2 del PDF. */
export interface CalendarioModalidad {
  readonly esquema: Esquema;
  /** Tasa anual de la cotización de esta modalidad, como texto decimal. */
  readonly tasa: string;
  readonly capitalInicial: string;
  /** La ganancia total del plazo de la cotización. */
  readonly rendimientoEstimado: string;
  readonly total: string;
  readonly filas: readonly FilaCalendario[];
}

/**
 * Rendimientos mes a mes de una modalidad. La suma de los meses es siempre la
 * ganancia total de la cotización:
 *   mensual (se cobra cada mes): pago = monto × tasa ÷ 12 a centavos; el último
 *     mes es la ganancia total menos la suma de los anteriores.
 *   final del plazo (se devenga y se paga al vencimiento): acumulado(k) =
 *     monto × tasa × k ÷ 12 a centavos; el mes es acumulado(k) − acumulado(k−1),
 *     así que puede variar un centavo entre meses.
 */
function rendimientosPorMes(
  esquema: Esquema,
  monto: Decimal,
  tasa: Decimal,
  plazo: number,
  gananciaTotal: Decimal,
): Decimal[] {
  const montoPorTasa = monto.times(tasa);
  if (esquema === "mensual") {
    const pago = aCentavos(montoPorTasa.div(MESES_POR_ANIO));
    const ultimo = gananciaTotal.minus(pago.times(plazo - 1));
    return Array.from({ length: plazo }, (_, i) => (i === plazo - 1 ? ultimo : pago));
  }
  const acumulado = (k: number) => aCentavos(montoPorTasa.times(k).div(MESES_POR_ANIO));
  return Array.from({ length: plazo }, (_, i) => acumulado(i + 1).minus(acumulado(i)));
}

/** Cotiza la solicitud con el esquema indicado y arma su calendario de pagos. */
export function calendarioModalidad(
  semilla: Semilla,
  solicitud: SolicitudTasa,
  esquema: Esquema,
): Resultado<CalendarioModalidad> {
  const r = cotizar(semilla, { ...solicitud, esquema });
  if (!r.ok) return fallo(r.error);

  const c = r.valor;
  const monto = new Decimal(c.solicitud.monto);
  const tasa = new Decimal(c.tasa);
  // La misma ganancia total que la cotización (calcularRendimientos).
  const gananciaTotal = aCentavos(monto.times(tasa).times(c.solicitud.plazo).div(MESES_POR_ANIO));

  let acumulado = new Decimal(0);
  const filas = rendimientosPorMes(esquema, monto, tasa, c.solicitud.plazo, gananciaTotal).map((rendimiento, i) => {
    acumulado = acumulado.plus(rendimiento);
    return { mes: i + 1, rendimiento: rendimiento.toFixed(2), acumulado: acumulado.toFixed(2) };
  });

  return exito(
    {
      esquema,
      tasa: c.tasa,
      capitalInicial: monto.toFixed(2),
      rendimientoEstimado: gananciaTotal.toFixed(2),
      total: monto.plus(gananciaTotal).toFixed(2),
      filas,
    },
    r.avisos,
  );
}

/** Las dos modalidades para la misma entidad, monto y plazo, cada una con su resultado. */
export function calendarios(
  semilla: Semilla,
  solicitud: SolicitudTasa,
): { readonly mensual: Resultado<CalendarioModalidad>; readonly finalDelPlazo: Resultado<CalendarioModalidad> } {
  return {
    mensual: calendarioModalidad(semilla, solicitud, "mensual"),
    finalDelPlazo: calendarioModalidad(semilla, solicitud, "final_del_plazo"),
  };
}
