import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/domain/comun/decimal";
import { calendarioDesdeTasa } from "../../../src/domain/interes/calendario";

// Valores de referencia calculados fuera del motor (Sprint 3a, plazo especial):
// 100,000 a 9 meses al 17% mensual: pago 100,000 × 0.17 ÷ 12 = 1,416.666… → 1,416.67;
// total 100,000 × 0.17 × 9 ÷ 12 = 12,750.00; ocho pagos de 1,416.67 y el último 1,416.64.
// Al vencimiento al 19%: total 100,000 × 0.19 × 9 ÷ 12 = 14,250.00.

describe("calendarioDesdeTasa: la aritmética de los calendarios con una tasa dada", () => {
  it("mensual, 100,000 a 9 meses al 17%", () => {
    const c = calendarioDesdeTasa(new Decimal("100000"), new Decimal("0.17"), 9, "mensual");
    expect(c.filas.map((f) => f.rendimiento)).toEqual([...Array(8).fill("1416.67"), "1416.64"]);
    expect(c.filas.at(-1)!.acumulado).toBe("12750.00");
    expect([c.capitalInicial, c.rendimientoEstimado, c.total, c.tasa, c.esquema]).toEqual(["100000.00", "12750.00", "112750.00", "0.17", "mensual"]);
  });

  it("al final del plazo, 100,000 a 9 meses al 19%", () => {
    const c = calendarioDesdeTasa(new Decimal("100000"), new Decimal("0.19"), 9, "final_del_plazo");
    expect(c.filas).toHaveLength(9);
    expect(c.filas[0]).toEqual({ mes: 1, rendimiento: "1583.33", acumulado: "1583.33" });
    expect(c.filas.at(-1)!.acumulado).toBe("14250.00");
    expect([c.rendimientoEstimado, c.total]).toEqual(["14250.00", "114250.00"]);
  });

  it("1 mes: una sola fila con toda la ganancia", () => {
    const c = calendarioDesdeTasa(new Decimal("30000"), new Decimal("0.18"), 1, "mensual");
    expect(c.filas).toEqual([{ mes: 1, rendimiento: "450.00", acumulado: "450.00" }]);
  });
});
