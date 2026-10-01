import type { Aviso, Resultado } from "../comun/resultado";
import { exito, fallo } from "../comun/resultado";
import { resolverTasa, type SolicitudTasa } from "../tasas/resolver";
import {
  etiquetasDelEsquema,
  type Esquema,
  type Estatus,
  type Moneda,
  type Salida,
  type Semilla,
} from "../tasas/semilla.esquema";
import { calcularRendimientos } from "./calcular";

export interface SalidaCotizada {
  readonly clave: Salida;
  readonly etiqueta: string;
  /** Valor sin redondear, como texto decimal sin exponente. */
  readonly exacto: string;
  /** 2 decimales, mitad hacia arriba, desde el exacto. */
  readonly redondeado: string;
  readonly desglose: { readonly formula: string; readonly operacion: string };
}

/**
 * Cotización lista para guardarse como snapshot: solo texto, números enteros y
 * null (JSON tal cual). Montos, tasas y salidas van como texto decimal.
 */
export interface Cotizacion {
  readonly solicitud: {
    readonly entidad: string;
    readonly moneda: Moneda;
    readonly esquema: Esquema;
    readonly monto: string;
    readonly plazo: number;
  };
  readonly tasa: string;
  readonly origenTasa: "tramo" | "plazo_adicional";
  readonly tramo: {
    readonly indice: number;
    readonly desde: string;
    readonly hasta: string | null;
    readonly estatus: Estatus | null;
  };
  /** Versión y fecha de la semilla con la que se calculó. */
  readonly semilla: { readonly version: string; readonly generado: string };
  /** En el orden de salidas_de_cotizacion de la semilla. */
  readonly salidas: readonly SalidaCotizada[];
  readonly avisos: readonly Aviso[];
}

/** Resuelve la tasa y calcula las salidas de la cotización con su desglose. */
export function cotizar(semilla: Semilla, solicitud: SolicitudTasa): Resultado<Cotizacion> {
  const r = resolverTasa(semilla, solicitud);
  if (!r.ok) return fallo(r.error);

  const t = r.valor;
  const rendimientos = calcularRendimientos(t.monto, t.tasa, t.plazo);
  const etiquetas = etiquetasDelEsquema(semilla.reglas, t.esquema);

  const cotizacion: Cotizacion = {
    solicitud: {
      entidad: t.entidad,
      moneda: t.moneda,
      esquema: t.esquema,
      monto: t.monto.toFixed(2),
      plazo: t.plazo,
    },
    tasa: t.tasa.toFixed(),
    origenTasa: t.origen,
    tramo: {
      indice: t.tramo.indice,
      desde: t.tramo.desde.toFixed(2),
      hasta: t.tramo.hasta === null ? null : t.tramo.hasta.toFixed(2),
      estatus: t.tramo.estatus,
    },
    semilla: { ...t.semilla },
    salidas: semilla.reglas.salidas.map((clave) => {
      const c = rendimientos[clave];
      return {
        clave,
        etiqueta: etiquetas[clave],
        exacto: c.exacto.toFixed(),
        redondeado: c.redondeado.toFixed(2),
        desglose: { ...c.desglose },
      };
    }),
    avisos: [...r.avisos],
  };
  return exito(cotizacion, cotizacion.avisos);
}
