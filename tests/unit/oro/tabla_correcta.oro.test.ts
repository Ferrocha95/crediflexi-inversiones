import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/domain/comun/decimal";
import { formatearPorcentaje } from "../../../src/domain/comun/formato";
import type { Esquema } from "../../../src/domain/tasas/semilla.esquema";
import { cotizarBien, salida } from "./ayudas";

// Siete casos de la Tabla de Diseño calculados por el usuario fuera del motor.
// "tramo" va del 1 al 6, como en la tabla; el índice del motor empieza en 0.

interface CasoTabla {
  readonly monto: string;
  readonly esquema: Esquema;
  readonly plazo: number;
  readonly tramo: number;
  readonly tasa: string;
  readonly mensual: string;
  readonly anual: string;
  readonly total: string;
}

const CASOS: readonly CasoTabla[] = [
  { monto: "55000", esquema: "mensual", plazo: 6, tramo: 1, tasa: "16.00%", mensual: "733.33", anual: "8800.00", total: "4400.00" },
  { monto: "200000", esquema: "mensual", plazo: 6, tramo: 1, tasa: "16.00%", mensual: "2666.67", anual: "32000.00", total: "16000.00" },
  { monto: "200000.99", esquema: "mensual", plazo: 6, tramo: 1, tasa: "16.00%", mensual: "2666.68", anual: "32000.16", total: "16000.08" },
  { monto: "200001", esquema: "mensual", plazo: 6, tramo: 2, tasa: "16.50%", mensual: "2750.01", anual: "33000.17", total: "16500.08" },
  { monto: "1500000", esquema: "mensual", plazo: 12, tramo: 6, tasa: "19.00%", mensual: "23750.00", anual: "285000.00", total: "285000.00" },
  { monto: "1500000", esquema: "final_del_plazo", plazo: 12, tramo: 6, tasa: "21.00%", mensual: "26250.00", anual: "315000.00", total: "315000.00" },
  { monto: "1000001", esquema: "mensual", plazo: 24, tramo: 6, tasa: "20.00%", mensual: "16666.68", anual: "200000.20", total: "400000.40" },
];

describe("oro (tabla correcta): siete casos de la Tabla de Diseño", () => {
  it("son siete casos", () => {
    expect(CASOS).toHaveLength(7);
  });

  it.each(CASOS.map((c) => [`${c.monto} pesos ${c.esquema} ${c.plazo} meses`, c] as const))(
    "%s: tramo, tasa y las tres cifras",
    (_n, c) => {
      const cot = cotizarBien({ monto: c.monto, esquema: c.esquema, plazo: c.plazo });
      expect(cot.tramo.indice + 1).toBe(c.tramo);
      expect(formatearPorcentaje(new Decimal(cot.tasa))).toBe(c.tasa);
      expect(salida(cot, "rendimiento_mensual_pesos").redondeado).toBe(c.mensual);
      expect(salida(cot, "rendimiento_anual_pesos").redondeado).toBe(c.anual);
      expect(salida(cot, "ganancia_total_plazo").redondeado).toBe(c.total);
    },
  );
});
