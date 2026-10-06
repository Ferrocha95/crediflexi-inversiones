// Calendario de pagos por modalidad (página 2 del PDF).
//
// Los valores esperados se calcularon fuera del motor (ejemplo del Excel de los
// ejecutivos y cuentas a mano); no se toman de lo que devuelve el motor.
// Modalidad 1: pago = monto × tasa ÷ 12 a centavos; el último mes cierra la
// ganancia total. Modalidad 2: acumulado(k) redondeado; el mes es la diferencia.

import { describe, expect, it } from "vitest";
import {
  calendarioModalidad,
  calendarios,
  type CalendarioModalidad,
} from "../../../src/domain/interes/calendario";
import type { SolicitudTasa } from "../../../src/domain/tasas/resolver";
import type { Esquema } from "../../../src/domain/tasas/semilla.esquema";
import { Decimal } from "../../../src/domain/comun/decimal";
import { semillaReal } from "../oro/ayudas";
import { casos } from "../oro/golden";

const ENTIDADES = ["CREDIFLEXI", "RAMI_SISE"] as const;

function solicitud(entidad: string, monto: string, plazo: number): SolicitudTasa {
  return { entidad, moneda: "MXN", esquema: "mensual", monto, plazo };
}

function calendarioBien(entidad: string, monto: string, plazo: number, esquema: Esquema): CalendarioModalidad {
  const r = calendarioModalidad(semillaReal, solicitud(entidad, monto, plazo), esquema);
  if (!r.ok) throw new Error(`Se esperaba un calendario: [${r.error.codigo}] ${r.error.mensaje}`);
  return r.valor;
}

const repetir = (valor: string, veces: number) => Array.from({ length: veces }, () => valor);

interface Referencia {
  readonly nombre: string;
  readonly monto: string;
  readonly plazo: number;
  readonly esquema: Esquema;
  readonly tasa: string;
  readonly rendimientos: readonly string[];
  readonly acumulados?: readonly string[];
  readonly estimado: string;
  readonly total: string;
}

const REFERENCIAS: readonly Referencia[] = [
  {
    nombre: "1,000,000 pesos a 6 meses, modalidad 1 (ejemplo del Excel)",
    monto: "1000000",
    plazo: 6,
    esquema: "mensual",
    tasa: "0.18",
    rendimientos: repetir("15000.00", 6),
    acumulados: ["15000.00", "30000.00", "45000.00", "60000.00", "75000.00", "90000.00"],
    estimado: "90000.00",
    total: "1090000.00",
  },
  {
    nombre: "1,000,000 pesos a 6 meses, modalidad 2 (ejemplo del Excel)",
    monto: "1000000",
    plazo: 6,
    esquema: "final_del_plazo",
    tasa: "0.2",
    rendimientos: ["16666.67", "16666.66", "16666.67", "16666.67", "16666.66", "16666.67"],
    acumulados: ["16666.67", "33333.33", "50000.00", "66666.67", "83333.33", "100000.00"],
    estimado: "100000.00",
    total: "1100000.00",
  },
  {
    nombre: "500,000 pesos a 12 meses, modalidad 1: once pagos iguales y el último ajusta",
    monto: "500000",
    plazo: 12,
    esquema: "mensual",
    tasa: "0.175",
    rendimientos: [...repetir("7291.67", 11), "7291.63"],
    estimado: "87500.00",
    total: "587500.00",
  },
  {
    nombre: "500,000 pesos a 12 meses, modalidad 2",
    monto: "500000",
    plazo: 12,
    esquema: "final_del_plazo",
    tasa: "0.195",
    rendimientos: repetir("8125.00", 12),
    estimado: "97500.00",
    total: "597500.00",
  },
  {
    nombre: "55,000 pesos a 6 meses, modalidad 1: cinco pagos iguales y el último ajusta",
    monto: "55000",
    plazo: 6,
    esquema: "mensual",
    tasa: "0.16",
    rendimientos: [...repetir("733.33", 5), "733.35"],
    estimado: "4400.00",
    total: "59400.00",
  },
  {
    nombre: "55,000 pesos a 6 meses, modalidad 2",
    monto: "55000",
    plazo: 6,
    esquema: "final_del_plazo",
    tasa: "0.18",
    rendimientos: repetir("825.00", 6),
    estimado: "4950.00",
    total: "59950.00",
  },
  {
    nombre: "1,500,000 pesos a 12 meses, modalidad 1",
    monto: "1500000",
    plazo: 12,
    esquema: "mensual",
    tasa: "0.19",
    rendimientos: repetir("23750.00", 12),
    estimado: "285000.00",
    total: "1785000.00",
  },
  {
    nombre: "1,500,000 pesos a 12 meses, modalidad 2",
    monto: "1500000",
    plazo: 12,
    esquema: "final_del_plazo",
    tasa: "0.21",
    rendimientos: repetir("26250.00", 12),
    estimado: "315000.00",
    total: "1815000.00",
  },
];

describe.each(ENTIDADES)("calendario por modalidad (%s): valores de referencia", (entidad) => {
  for (const ref of REFERENCIAS) {
    it(ref.nombre, () => {
      const c = calendarioBien(entidad, ref.monto, ref.plazo, ref.esquema);
      expect(c.esquema).toBe(ref.esquema);
      expect(new Decimal(c.tasa).eq(ref.tasa)).toBe(true);
      expect(c.capitalInicial).toBe(new Decimal(ref.monto).toFixed(2));
      expect(c.rendimientoEstimado).toBe(ref.estimado);
      expect(c.total).toBe(ref.total);
      expect(c.filas.map((f) => f.mes)).toEqual(Array.from({ length: ref.plazo }, (_, i) => i + 1));
      expect(c.filas.map((f) => f.rendimiento)).toEqual(ref.rendimientos);
      if (ref.acumulados) expect(c.filas.map((f) => f.acumulado)).toEqual(ref.acumulados);
      expect(c.filas.at(-1)?.acumulado).toBe(ref.estimado);
    });
  }
});

describe("calendario por modalidad: las dos modalidades a la vez", () => {
  it("calendarios cotiza las dos modalidades para la misma entidad, monto y plazo", () => {
    const { mensual, finalDelPlazo } = calendarios(semillaReal, solicitud("CREDIFLEXI", "1000000", 6));
    expect(mensual.ok && mensual.valor.esquema).toBe("mensual");
    expect(finalDelPlazo.ok && finalDelPlazo.valor.esquema).toBe("final_del_plazo");
    expect(mensual.ok && mensual.valor.total).toBe("1090000.00");
    expect(finalDelPlazo.ok && finalDelPlazo.valor.total).toBe("1100000.00");
  });

  it("si una modalidad no se puede cotizar, devuelve su error y la otra sigue", () => {
    const { mensual, finalDelPlazo } = calendarios(semillaReal, solicitud("CREDIFLEXI", "1000", 6));
    expect(mensual.ok).toBe(false);
    expect(finalDelPlazo.ok).toBe(false);
    if (!mensual.ok) expect(mensual.error.codigo).toBe("MONTO_FUERA_DE_RANGO");
  });
});

// Cada par (monto, plazo) del golden, con las ganancias totales del golden.
const pares = [...new Set(casos.map((c) => `${c.monto}|${c.plazo}`))].map((par) => {
  const [monto, plazo] = par.split("|");
  const celda = (esquema: Esquema) =>
    casos.find((c) => c.monto === monto && c.plazo === Number(plazo) && c.esquema === esquema)!;
  return { monto, plazo: Number(plazo), mensual: celda("mensual"), final: celda("final_del_plazo") };
});

describe("calendario por modalidad: cada par del golden", () => {
  it("el golden trae los dos esquemas para cada par", () => {
    expect(pares.length).toBeGreaterThan(0);
    for (const p of pares) {
      expect(p.mensual, `${p.monto} a ${p.plazo} meses sin celda mensual`).toBeDefined();
      expect(p.final, `${p.monto} a ${p.plazo} meses sin celda al final del plazo`).toBeDefined();
    }
  });

  it.each(pares.map((p) => [p.mensual.nombre.replace(" mensual", ""), p] as const))("%s", (_n, p) => {
    const m1 = calendarioBien("CREDIFLEXI", p.monto, p.plazo, "mensual");
    const m2 = calendarioBien("CREDIFLEXI", p.monto, p.plazo, "final_del_plazo");
    const monto = new Decimal(p.monto);

    expect(m1.filas).toHaveLength(p.plazo);
    expect(m2.filas).toHaveLength(p.plazo);

    const suma = m1.filas.reduce((s, f) => s.plus(f.rendimiento), new Decimal(0));
    expect(suma.toFixed(2)).toBe(p.mensual.celda.ganancia_total_plazo);
    expect(m2.filas.at(-1)!.acumulado).toBe(p.final.celda.ganancia_total_plazo);

    for (const [c, ganancia] of [
      [m1, p.mensual.celda.ganancia_total_plazo],
      [m2, p.final.celda.ganancia_total_plazo],
    ] as const) {
      expect(c.capitalInicial).toBe(monto.toFixed(2));
      expect(c.rendimientoEstimado).toBe(ganancia);
      expect(c.total).toBe(monto.plus(ganancia).toFixed(2));
    }
  });
});
