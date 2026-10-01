import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/domain/comun/decimal";
import { calcularRendimientos } from "../../../src/domain/interes/calcular";

const d = (s: string) => new Decimal(s);

describe("calcularRendimientos", () => {
  it("$500,000 a 12 meses al 17.5%: 7,291.67 mensual y 87,500.00 anual", () => {
    const r = calcularRendimientos(d("500000"), d("0.175"), 12);
    expect(r.rendimiento_mensual_pesos.redondeado.toFixed(2)).toBe("7291.67");
    expect(r.rendimiento_anual_pesos.redondeado.toFixed(2)).toBe("87500.00");
    expect(r.ganancia_total_plazo.redondeado.toFixed(2)).toBe("87500.00");
  });

  it("conserva el valor exacto antes de redondear", () => {
    const r = calcularRendimientos(d("500000"), d("0.175"), 12);
    expect(r.rendimiento_mensual_pesos.exacto.toFixed(10)).toBe("7291.6666666667");
    expect(r.rendimiento_anual_pesos.exacto.toFixed()).toBe("87500");
    expect(r.ganancia_total_plazo.exacto.toFixed()).toBe("87500");
  });

  it("el anual nunca se calcula desde el mensual redondeado", () => {
    // 7,291.67 × 12 = 87,500.04; la fórmula da 87,500.00.
    const r = calcularRendimientos(d("500000"), d("0.175"), 6);
    expect(r.rendimiento_mensual_pesos.redondeado.times(12).toFixed(2)).toBe("87500.04");
    expect(r.rendimiento_anual_pesos.redondeado.toFixed(2)).toBe("87500.00");
  });

  it("el total nunca se calcula desde el mensual redondeado", () => {
    // 7,291.67 × 18 = 131,250.06; la fórmula da 131,250.00.
    const r = calcularRendimientos(d("500000"), d("0.175"), 18);
    expect(r.ganancia_total_plazo.redondeado.toFixed(2)).toBe("131250.00");
  });

  it("el total depende del plazo: 6 meses es la mitad del anual", () => {
    const r = calcularRendimientos(d("500000"), d("0.175"), 6);
    expect(r.ganancia_total_plazo.redondeado.toFixed(2)).toBe("43750.00");
  });

  it("un empate a medio centavo en el mensual sube", () => {
    // 740.70 × 0.2 ÷ 12 = 12.345 exacto.
    const r = calcularRendimientos(d("740.70"), d("0.2"), 12);
    expect(r.rendimiento_mensual_pesos.exacto.toFixed()).toBe("12.345");
    expect(r.rendimiento_mensual_pesos.redondeado.toFixed(2)).toBe("12.35");
  });

  it("un empate a medio centavo en el anual sube", () => {
    // 10.10 × 0.25 = 2.525 exacto.
    const r = calcularRendimientos(d("10.10"), d("0.25"), 12);
    expect(r.rendimiento_anual_pesos.redondeado.toFixed(2)).toBe("2.53");
  });

  it("multiplica antes de dividir: el total con plazo de 7 meses no pierde precisión", () => {
    // 100000.01 × 0.19 × 7 ÷ 12 = 11083.334441666...
    const r = calcularRendimientos(d("100000.01"), d("0.19"), 7);
    expect(r.ganancia_total_plazo.exacto.toFixed(8)).toBe("11083.33444167");
    expect(r.ganancia_total_plazo.redondeado.toFixed(2)).toBe("11083.33");
  });

  it("muestra la fórmula y la operación con sus números", () => {
    const r = calcularRendimientos(d("1500000"), d("0.19"), 12);
    expect(r.rendimiento_mensual_pesos.desglose).toEqual({
      formula: "monto × tasa anual ÷ 12",
      operacion: "1,500,000.00 × 0.19 ÷ 12 = 23,750.00",
    });
    expect(r.rendimiento_anual_pesos.desglose).toEqual({
      formula: "monto × tasa anual",
      operacion: "1,500,000.00 × 0.19 = 285,000.00",
    });
    expect(r.ganancia_total_plazo.desglose).toEqual({
      formula: "monto × tasa anual × plazo ÷ 12",
      operacion: "1,500,000.00 × 0.19 × 12 ÷ 12 = 285,000.00",
    });
  });
});
