import { describe, expect, it } from "vitest";
import { Decimal } from "../../../src/domain/comun/decimal";
import { aCentavos, aPesosEnteros } from "../../../src/domain/interes/redondeo";

const d = (s: string) => new Decimal(s);

describe("aCentavos", () => {
  it("deja 2 decimales", () => {
    expect(aCentavos(d("87500")).toFixed(2)).toBe("87500.00");
    expect(aCentavos(d("7291.666666666666")).toFixed(2)).toBe("7291.67");
  });

  it("un empate a medio centavo sube (mitad hacia arriba)", () => {
    // 12.345 es empate exacto: hacia abajo daría 12.34 y "mitad al par" también 12.34.
    expect(aCentavos(d("12.345")).toFixed(2)).toBe("12.35");
    expect(aCentavos(d("2.525")).toFixed(2)).toBe("2.53");
  });

  it("debajo del medio centavo baja", () => {
    expect(aCentavos(d("12.3449999")).toFixed(2)).toBe("12.34");
  });
});

describe("aPesosEnteros (solo para comparar con el pptx)", () => {
  it("un empate a medio peso sube: 512.50 a 513", () => {
    expect(aPesosEnteros(d("512.50")).toFixed(0)).toBe("513");
  });

  it("debajo del medio peso baja", () => {
    expect(aPesosEnteros(d("7291.49")).toFixed(0)).toBe("7291");
  });

  it("redondea desde el valor recibido, sin pasar antes por centavos", () => {
    // Doble redondeo: 512.495 -> 512.50 -> 513. Desde el exacto debe dar 512.
    expect(aPesosEnteros(d("512.495")).toFixed(0)).toBe("512");
  });
});
