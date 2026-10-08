import { Decimal } from "../domain/comun/decimal";
import { formatearPorcentaje } from "../domain/comun/formato";
import { PUNTOS_EXTRA, tasaMaximaDeTabla, type Ajuste } from "../domain/interes/ajustes";
import type { Esquema, Moneda, Semilla } from "../domain/tasas/semilla.esquema";
import { error, ok, type ResultadoApp } from "./resultado";

/** Lo que manda la pantalla sobre los ajustes de la tasa (vista previa y PDF). */
export interface CamposAjuste {
  /** Puntos extra sobre la tasa de tabla ("0.0" a "5.0"). */
  readonly puntosExtra: string;
  /** Plazo especial con sus tasas acordadas en porcentaje; null = plazo de tabla. */
  readonly especial: { readonly plazo: number; readonly tasaMensual: string | null; readonly tasaFinal: string | null } | null;
}

/** Opciones del selector de puntos extra, de PUNTOS_EXTRA del dominio: "0.0", "0.5", … "5.0". */
export const OPCIONES_PUNTOS: readonly string[] = (() => {
  const opciones: string[] = [];
  for (let p = PUNTOS_EXTRA.minimo; p.lte(PUNTOS_EXTRA.maximo); p = p.plus(PUNTOS_EXTRA.paso)) opciones.push(p.toFixed(1));
  return opciones;
})();

/**
 * Puntos sobre la tasa más alta de la tabla a partir de los cuales una tasa
 * acordada se avisa (no bloquea). Regla del dueño; pendiente pasarla a la semilla.
 */
export const PUNTOS_AVISO_TASA_ACORDADA = new Decimal(5);

/** Convierte los campos de la pantalla en el ajuste del dominio. */
export function ajusteDesdeCampos(c: CamposAjuste): ResultadoApp<Ajuste> {
  if (c.especial === null) return ok({ tipo: "tabla", puntos: c.puntosExtra });
  if (!/^[0-9]+(\.[0-9]+)?$/.test(c.puntosExtra) || !new Decimal(c.puntosExtra).isZero()) {
    return error(
      "AJUSTE_INVALIDO",
      "Los puntos extra solo aplican a plazos de la tabla; el plazo especial ya trae su tasa acordada. Deja los puntos en 0.",
    );
  }
  const tasas: Partial<Record<Esquema, string>> = {};
  const mensual = c.especial.tasaMensual?.trim() ?? "";
  const final = c.especial.tasaFinal?.trim() ?? "";
  if (mensual !== "") tasas.mensual = mensual;
  if (final !== "") tasas.final_del_plazo = final;
  return ok({ tipo: "especial", plazo: c.especial.plazo, tasas });
}

export interface AvisoTasaAcordada {
  readonly tasa: string;
  readonly maximoTabla: string;
  readonly limite: string;
}

/**
 * Aviso no bloqueante si la tasa acordada (fracción, como texto) pasa de la
 * máxima de la tabla de la moneda más PUNTOS_AVISO_TASA_ACORDADA puntos.
 */
export function avisoTasaAcordada(semilla: Semilla, moneda: Moneda, tasa: string): AvisoTasaAcordada | null {
  const maximo = tasaMaximaDeTabla(semilla, moneda);
  if (maximo === null) return null;
  const limite = maximo.plus(PUNTOS_AVISO_TASA_ACORDADA.div(100));
  const t = new Decimal(tasa);
  if (!t.gt(limite)) return null;
  return { tasa: formatearPorcentaje(t), maximoTabla: formatearPorcentaje(maximo), limite: formatearPorcentaje(limite) };
}
