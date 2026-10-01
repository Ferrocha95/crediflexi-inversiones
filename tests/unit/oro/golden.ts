import golden from "../../golden/rendimientos_pptx.json";
import { Decimal } from "../../../src/domain/comun/decimal";
import { formatearCantidad } from "../../../src/domain/comun/formato";
import { cotizar, type Cotizacion } from "../../../src/domain/interes/cotizar";
import type { Esquema, Salida } from "../../../src/domain/tasas/semilla.esquema";
import { base, salida, semillaReal } from "./ayudas";

// Lectura del golden (solo datos: no cotiza al importarse) y un intento de
// cotización que nunca lanza, para que una celda que no cotiza falle en su
// propia prueba y no tumbe el archivo completo.

/** Formato del golden: "final" es el esquema final_del_plazo. */
const ESQUEMA_DEL_GOLDEN: Readonly<Record<string, Esquema>> = { mensual: "mensual", final: "final_del_plazo" };

export interface CeldaGolden {
  readonly tasa: string;
  readonly fuente: string;
  readonly ganancia_pptx: number | null;
  readonly ganancia_formula: number;
  readonly rendimiento_mensual_pesos: string;
  readonly rendimiento_anual_pesos: string;
  readonly ganancia_total_plazo: string;
  readonly pago_mensual_pptx?: number | null;
  readonly pago_mensual_formula?: number;
  readonly pptx_con_error: readonly string[];
  readonly pptx_dice_na: boolean;
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
        nombre: `$${formatearCantidad(new Decimal(monto))} ${esquemaGolden} ${plazo} meses`,
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

/** Cifras del pptx comparables con el motor: nombre del campo en pptx_con_error y salida del motor. */
const CIFRAS_PPTX = [
  { campo: "ganancia", pptx: "ganancia_pptx", salida: "ganancia_total_plazo" },
  { campo: "pago_mensual", pptx: "pago_mensual_pptx", salida: "rendimiento_mensual_pesos" },
] as const;

export interface CifraPptx {
  readonly caso: Caso;
  readonly campo: (typeof CIFRAS_PPTX)[number]["campo"];
  readonly salida: Salida;
  readonly pptx: Decimal;
  readonly marcadaConError: boolean;
}

/** Todas las cifras que trae el pptx, tomadas solo del golden (las celdas de decisión del usuario no traen). */
export const cifrasPptx: readonly CifraPptx[] = casos
  .filter((c) => c.celda.fuente === "pptx")
  .flatMap((caso) =>
    CIFRAS_PPTX.flatMap((f) => {
      const valor = caso.celda[f.pptx];
      if (valor === undefined || valor === null) return [];
      return [
        {
          caso,
          campo: f.campo,
          salida: f.salida,
          pptx: new Decimal(String(valor)),
          marcadaConError: caso.celda.pptx_con_error.includes(f.campo),
        },
      ];
    }),
  );

/** Valor exacto del motor para una cifra del pptx, o null si la celda no cotizó. */
export function motorDe(cifra: CifraPptx, intento: Intento): Decimal | null {
  return intento.ok ? new Decimal(salida(intento.cotizacion, cifra.salida).exacto) : null;
}

/** Tolerancia contra el pptx: sus cifras vienen en pesos enteros. */
export const TOLERANCIA_PPTX = new Decimal("0.50");
