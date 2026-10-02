import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/domain/comun/decimal";
import { aPesosEnteros } from "../../../src/domain/interes/redondeo";
import { salida } from "./ayudas";
import { casos, cotizacionDe, intentarCotizar, type Caso, type Intento } from "./golden";

// Un intento por celda, sin lanzar: si una celda no cotiza, fallan solo sus pruebas.
const intentos = new Map<Caso, Intento>(casos.map((c) => [c, intentarCotizar(c)]));
const intentoDe = (c: Caso): Intento => intentos.get(c)!;

describe("oro (a): las 160 celdas del golden", () => {
  it("el golden trae 160 celdas", () => {
    expect(casos).toHaveLength(160);
  });

  it.each(casos.map((c) => [c.nombre, c] as const))("%s", (_nombre, c) => {
    const cot = cotizacionDe(c, intentoDe(c));

    // Tasa: igualdad decimal (no de texto).
    expect(new Decimal(cot.tasa).eq(new Decimal(c.celda.tasa))).toBe(true);

    // Las tres salidas, como texto con 2 decimales.
    expect(salida(cot, "rendimiento_mensual_pesos").redondeado).toBe(c.celda.rendimiento_mensual_pesos);
    expect(salida(cot, "rendimiento_anual_pesos").redondeado).toBe(c.celda.rendimiento_anual_pesos);
    expect(salida(cot, "ganancia_total_plazo").redondeado).toBe(c.celda.ganancia_total_plazo);

    // Valores "por fórmula" del golden, en pesos enteros desde el exacto.
    const total = new Decimal(salida(cot, "ganancia_total_plazo").exacto);
    expect(aPesosEnteros(total).toFixed(0)).toBe(String(c.celda.ganancia_formula));
    if (c.celda.pago_mensual_formula !== undefined) {
      const mensual = new Decimal(salida(cot, "rendimiento_mensual_pesos").exacto);
      expect(aPesosEnteros(mensual).toFixed(0)).toBe(String(c.celda.pago_mensual_formula));
    }
  });
});

describe("oro (a): el tramo de cada celda es el tramo_indice del golden", () => {
  it.each(casos.map((c) => [c.nombre, c.celda.tramo_indice, c] as const))("%s: tramo %s", (_n, esperado, c) => {
    expect(cotizacionDe(c, intentoDe(c)).tramo.indice).toBe(esperado);
  });
});

describe("oro (a): ninguna celda del golden trae aviso", () => {
  it("las 160 celdas cotizan sin avisos", () => {
    const conAviso = casos.filter((c) => cotizacionDe(c, intentoDe(c)).avisos.length > 0).map((c) => c.nombre);
    expect(casos).toHaveLength(160);
    expect(conAviso).toEqual([]);
  });
});
