import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/domain/comun/decimal";
import { bonoDeExterno } from "../../../src/domain/comisiones/bonoExterno";
import { cargar, copiaSemilla, semillaComisiones as s } from "./ayudas";

// Valores de referencia INDEPENDIENTES (Sprint 5, punto C, dados por Fernando):
// bono de externos por captación NUEVA del mes, siempre más la comisión.
// Menos de $1,000,000, sin bono.

const bono = (captacion: string) => bonoDeExterno(s, new Decimal(captacion)).bono.toFixed(2);

describe("bonoDeExterno: valores de referencia", () => {
  it.each([
    ["999999", "0.00"],
    ["1000000", "15000.00"],
    ["1499999", "15000.00"],
    ["1500000", "20000.00"],
    ["1999999", "20000.00"],
    ["2000000", "25000.00"],
  ] as const)("captación nueva %s: bono %s", (captacion, esperado) => {
    expect(bono(captacion)).toBe(esperado);
  });

  it.each([
    ["999999.99", "0.00"],
    ["1000000.00", "15000.00"],
    ["1499999.50", "15000.00"],
  ] as const)("con centavos, %s: bono %s", (captacion, esperado) => {
    expect(bono(captacion)).toBe(esperado);
  });

  it("sin captación no hay bono ni rango", () => {
    const b = bonoDeExterno(s, new Decimal(0));
    expect(b.bono.toFixed(2)).toBe("0.00");
    expect(b.rango).toBeNull();
  });

  it("devuelve el rango que aplica: 2,000,000 en adelante no tiene tope", () => {
    const b = bonoDeExterno(s, new Decimal("50000000"));
    expect(b.bono.toFixed(2)).toBe("25000.00");
    expect(b.rango?.desde.toFixed(0)).toBe("2000000");
    expect(b.rango?.hasta).toBeNull();
  });

  it("1,500,000 cae en el rango de 1,500,000 a 1,999,999", () => {
    const b = bonoDeExterno(s, new Decimal("1500000"));
    expect([b.rango?.desde.toFixed(0), b.rango?.hasta?.toFixed(0)]).toEqual(["1500000", "1999999"]);
  });

  it("el bono sale de incentivos_propuesta, no del código", () => {
    const j = copiaSemilla();
    const fila = j.incentivos_propuesta.find((f) => f.tipo === "EXTERNOS" && f.desde === 1000000) as Record<string, unknown>;
    fila.bono = 16000;
    expect(bonoDeExterno(cargar(j), new Decimal("1000000")).bono.toFixed(2)).toBe("16000.00");
  });
});
