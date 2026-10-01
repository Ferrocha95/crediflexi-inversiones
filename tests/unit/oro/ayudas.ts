import golden from "../../golden/rendimientos_pptx.json";
import semillaJson from "../../../seed/parametros_iniciales.json";
import { Decimal } from "../../../src/domain/comun/decimal";
import type { CodigoError } from "../../../src/domain/comun/errores";
import { formatearCantidad } from "../../../src/domain/comun/formato";
import { cotizar, type Cotizacion, type SalidaCotizada } from "../../../src/domain/interes/cotizar";
import type { SolicitudTasa } from "../../../src/domain/tasas/resolver";
import { cargarSemilla } from "../../../src/domain/tasas/semilla";
import type { Esquema, Salida, Semilla } from "../../../src/domain/tasas/semilla.esquema";

export type SemillaJson = typeof semillaJson;

/** Copia profunda de la semilla real para modificarla en una prueba. */
export const copiaSemilla = (): SemillaJson => structuredClone(semillaJson);

export function cargar(json: unknown): Semilla {
  const r = cargarSemilla(json);
  if (!r.ok) throw new Error(`${r.error.mensaje}\n${(r.error.detalles ?? []).join("\n")}`);
  return r.valor;
}

export const semillaReal = cargar(semillaJson);

export const base: SolicitudTasa = {
  entidad: "CREDIFLEXI",
  moneda: "MXN",
  esquema: "mensual",
  monto: "1500000",
  plazo: 12,
};

export function cotizarBien(cambios: Partial<SolicitudTasa>, s: Semilla = semillaReal): Cotizacion {
  const r = cotizar(s, { ...base, ...cambios });
  if (!r.ok) throw new Error(`Se esperaba una cotización: [${r.error.codigo}] ${r.error.mensaje}`);
  return r.valor;
}

export function codigoDeError(cambios: Partial<SolicitudTasa>, s: Semilla = semillaReal): CodigoError | "OK" {
  const r = cotizar(s, { ...base, ...cambios });
  return r.ok ? "OK" : r.error.codigo;
}

export function salida(c: Cotizacion, clave: Salida): SalidaCotizada {
  const s = c.salidas.find((x) => x.clave === clave);
  if (s === undefined) throw new Error(`La cotización no trae la salida ${clave}`);
  return s;
}

// ---------------------------------------------------------------------------
// Golden
// ---------------------------------------------------------------------------

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

export const cotizarCaso = (c: Caso): Cotizacion => cotizarBien({ monto: c.monto, esquema: c.esquema, plazo: c.plazo });

/** Cifras del pptx comparables con el motor: nombre del campo en pptx_con_error y salida del motor. */
export const CIFRAS_PPTX = [
  { campo: "ganancia", pptx: "ganancia_pptx", salida: "ganancia_total_plazo" },
  { campo: "pago_mensual", pptx: "pago_mensual_pptx", salida: "rendimiento_mensual_pesos" },
] as const;

export interface CifraPptx {
  readonly caso: Caso;
  readonly campo: (typeof CIFRAS_PPTX)[number]["campo"];
  readonly salida: Salida;
  readonly pptx: Decimal;
  /** Valor exacto del motor. */
  readonly motor: Decimal;
  /** |motor exacto − pptx|. */
  readonly diferencia: Decimal;
  readonly marcadaConError: boolean;
}

/** Todas las cifras que trae el pptx (las celdas de decisión del usuario no traen). */
export const cifrasPptx: readonly CifraPptx[] = casos
  .filter((c) => c.celda.fuente === "pptx")
  .flatMap((caso) => {
    const cot = cotizarCaso(caso);
    return CIFRAS_PPTX.flatMap((f) => {
      const valor = caso.celda[f.pptx];
      if (valor === undefined || valor === null) return [];
      const pptx = new Decimal(String(valor));
      const motor = new Decimal(salida(cot, f.salida).exacto);
      return [
        {
          caso,
          campo: f.campo,
          salida: f.salida,
          pptx,
          motor,
          diferencia: motor.minus(pptx).abs(),
          marcadaConError: caso.celda.pptx_con_error.includes(f.campo),
        },
      ];
    });
  });

/** Tolerancia contra el pptx: sus cifras vienen en pesos enteros. */
export const TOLERANCIA_PPTX = new Decimal("0.50");
