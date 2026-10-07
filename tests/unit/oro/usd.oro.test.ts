import { describe, expect, it } from "vitest";
import golden from "../../golden/rendimientos_usd.json";
import { Decimal } from "../../../src/domain/comun/decimal";
import { formatearCantidad } from "../../../src/domain/comun/formato";
import { cotizar } from "../../../src/domain/interes/cotizar";
import type { Esquema } from "../../../src/domain/tasas/semilla.esquema";
import { codigoDeError, salida, semillaReal } from "./ayudas";

// Las 128 celdas de tests/golden/rendimientos_usd.json (folleto USD de Rami
// Sise), calculadas fuera del motor. Los campos "…_pesos" del archivo son
// DÓLARES: se conservan los nombres de las salidas del motor.

const ESQUEMA_DEL_GOLDEN: Readonly<Record<string, Esquema>> = { mensual: "mensual", final: "final_del_plazo" };

interface CeldaUsd {
  readonly tasa: string;
  readonly tramo_indice: number;
  readonly rendimiento_mensual_pesos: string;
  readonly rendimiento_anual_pesos: string;
  readonly ganancia_total_plazo: string;
}

const casos = Object.entries(golden.casos).flatMap(([monto, porEsquema]) =>
  Object.entries(porEsquema).flatMap(([esquemaGolden, porPlazo]) =>
    Object.entries(porPlazo as Record<string, CeldaUsd>).map(([plazo, celda]) => ({
      // Sin "$" delante de la cifra: en los títulos de Vitest "$" seguido de un dígito se interpola.
      nombre: `${formatearCantidad(new Decimal(monto))} dólares ${esquemaGolden} ${plazo} meses`,
      monto,
      esquema: ESQUEMA_DEL_GOLDEN[esquemaGolden],
      plazo: Number(plazo),
      celda,
    })),
  ),
);

const RAMI_USD = { entidad: "RAMI_SISE", moneda: "USD" } as const;

describe("oro USD: las 128 celdas del folleto de Rami Sise", () => {
  it("el archivo trae 128 celdas, todas de RAMI_SISE en USD", () => {
    expect(casos).toHaveLength(128);
    expect([golden.entidad, golden.moneda]).toEqual(["RAMI_SISE", "USD"]);
  });

  it.each(casos.map((c) => [c.nombre, c] as const))("%s", (_n, c) => {
    const r = cotizar(semillaReal, { ...RAMI_USD, monto: c.monto, esquema: c.esquema, plazo: c.plazo });
    if (!r.ok) throw new Error(`No cotiza: [${r.error.codigo}] ${r.error.mensaje}`);
    const cot = r.valor;
    expect(new Decimal(cot.tasa).eq(new Decimal(c.celda.tasa))).toBe(true);
    expect(cot.tramo.indice).toBe(c.celda.tramo_indice);
    expect(cot.solicitud.moneda).toBe("USD");
    expect(salida(cot, "rendimiento_mensual_pesos").redondeado).toBe(c.celda.rendimiento_mensual_pesos);
    expect(salida(cot, "rendimiento_anual_pesos").redondeado).toBe(c.celda.rendimiento_anual_pesos);
    expect(salida(cot, "ganancia_total_plazo").redondeado).toBe(c.celda.ganancia_total_plazo);
  });
});

describe("USD: solo para RAMI_SISE y desde 4,000 dólares", () => {
  it("CREDIFLEXI en USD responde ENTIDAD_SIN_TABLA", () => {
    expect(codigoDeError({ entidad: "CREDIFLEXI", moneda: "USD", monto: "10000", plazo: 12 })).toBe("ENTIDAD_SIN_TABLA");
  });

  it("3,999.99 dólares queda debajo del mínimo", () => {
    expect(codigoDeError({ ...RAMI_USD, monto: "3999.99", plazo: 12 })).toBe("MONTO_FUERA_DE_RANGO");
  });

  it("4,000 dólares exactos sí cotiza (límite inferior inclusivo)", () => {
    expect(codigoDeError({ ...RAMI_USD, monto: "4000", plazo: 6 })).toBe("OK");
  });

  it("RAMI_SISE en MXN sigue cotizando como antes", () => {
    expect(codigoDeError({ entidad: "RAMI_SISE", monto: "1500000", plazo: 12 })).toBe("OK");
  });
});
