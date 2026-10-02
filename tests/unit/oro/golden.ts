import golden from "../../golden/rendimientos_pptx.json";
import { Decimal } from "../../../src/domain/comun/decimal";
import { formatearCantidad } from "../../../src/domain/comun/formato";
import { cotizar, type Cotizacion } from "../../../src/domain/interes/cotizar";
import type { Esquema } from "../../../src/domain/tasas/semilla.esquema";
import { base, semillaReal } from "./ayudas";

// Lectura del golden (solo datos: no cotiza al importarse) y un intento de
// cotización que nunca lanza, para que una celda que no cotiza falle en su
// propia prueba y no tumbe el archivo completo.

/** Formato del golden: "final" es el esquema final_del_plazo. */
const ESQUEMA_DEL_GOLDEN: Readonly<Record<string, Esquema>> = { mensual: "mensual", final: "final_del_plazo" };

export interface CeldaGolden {
  readonly tasa: string;
  /** Tramo esperado (0 a 5), calculado fuera del motor con "hasta" inclusivo. */
  readonly tramo_indice: number;
  readonly ganancia_formula: number;
  readonly rendimiento_mensual_pesos: string;
  readonly rendimiento_anual_pesos: string;
  readonly ganancia_total_plazo: string;
  /** Solo en el esquema mensual. */
  readonly pago_mensual_formula?: number;
}

export interface Caso {
  readonly nombre: string;
  readonly monto: string;
  readonly esquemaGolden: string;
  readonly esquema: Esquema;
  readonly plazo: number;
  readonly celda: CeldaGolden;
}

export const casos: readonly Caso[] = Object.entries(golden.casos).flatMap(([monto, porEsquema]) =>
  Object.entries(porEsquema).flatMap(([esquemaGolden, porPlazo]) =>
    Object.entries(porPlazo as Record<string, CeldaGolden>).map(([plazo, celda]) => {
      const esquema = ESQUEMA_DEL_GOLDEN[esquemaGolden];
      if (esquema === undefined) throw new Error(`Esquema desconocido en el golden: ${esquemaGolden}`);
      return {
        // Sin "$" delante de la cifra: en los títulos de Vitest "$" seguido de un dígito se interpola.
        nombre: `${formatearCantidad(new Decimal(monto))} pesos ${esquemaGolden} ${plazo} meses`,
        monto,
        esquemaGolden,
        esquema,
        plazo: Number(plazo),
        celda,
      };
    }),
  ),
);

export type Intento =
  | { readonly ok: true; readonly cotizacion: Cotizacion }
  | { readonly ok: false; readonly motivo: string };

/** Cotiza una celda del golden sin lanzar nunca: si falla, devuelve el motivo. */
export function intentarCotizar(c: Caso): Intento {
  try {
    const r = cotizar(semillaReal, { ...base, monto: c.monto, esquema: c.esquema, plazo: c.plazo });
    return r.ok ? { ok: true, cotizacion: r.valor } : { ok: false, motivo: `[${r.error.codigo}] ${r.error.mensaje}` };
  } catch (e) {
    return { ok: false, motivo: `excepción: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Dentro de una prueba: la cotización o un error claro con el motivo. */
export function cotizacionDe(c: Caso, intento: Intento): Cotizacion {
  if (!intento.ok) throw new Error(`La celda ${c.nombre} no cotiza: ${intento.motivo}`);
  return intento.cotizacion;
}
