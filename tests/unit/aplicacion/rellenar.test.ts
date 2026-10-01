import { describe, expect, it } from "vitest";
import { rellenar } from "../../../src/aplicacion/rellenar";

describe("rellenar", () => {
  it("sustituye cada marcador por su valor", () => {
    expect(rellenar("Preparado por {ejecutivo}.", { ejecutivo: "Ejecutivo Prueba" })).toBe(
      "Preparado por Ejecutivo Prueba.",
    );
  });

  it("sustituye todas las apariciones", () => {
    expect(rellenar("{moneda} y {moneda}", { moneda: "USD" })).toBe("USD y USD");
  });

  it("un texto sin marcadores queda igual", () => {
    expect(rellenar("Tasa confirmada.", {})).toBe("Tasa confirmada.");
  });

  it("inserta el valor literal: no interpreta $& ni vuelve a sustituir marcadores dentro del valor", () => {
    expect(rellenar("A {ejecutivo} B", { ejecutivo: "$& {vigencia}", vigencia: "no" })).toBe("A $& {vigencia} B");
  });

  it("si falta el valor de un marcador, lanza un error que lo nombra", () => {
    expect(() => rellenar("Vigencia: {vigencia}.", { ejecutivo: "x" })).toThrow("{vigencia}");
  });

  it("un marcador desconocido también lanza", () => {
    expect(() => rellenar("{cliente}", {})).toThrow("{cliente}");
  });
});
