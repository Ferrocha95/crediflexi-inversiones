import { describe, expect, it } from "vitest";
import { comisionDeInversion } from "../../../src/domain/comisiones/comision";
import { bien, mal, semillaComisiones as s } from "./ayudas";

// Valores de referencia INDEPENDIENTES: calculados fuera del motor con las
// tasas completas del Excel Bono_Quincenal (tabla N1), sin redondear la tasa.
// La comisión es monto × tasa, a 2 decimales, mitad hacia arriba.

const comision = (tipo: "nueva" | "renovacion", monto: string, plazo: number) => bien(comisionDeInversion(s, { tipo, monto, plazo }));

describe("comisionDeInversion: nuevas (N1)", () => {
  it.each([
    ["1500000", 12, "0.02904", "43560.00"],
    ["500000", 24, "0.05658", "28290.00"],
    ["55000", 6, "0.012", "660.00"],
    ["300000", 6, "0.012", "3600.00"],
    ["300001", 6, "0.0123", "3690.01"],
    ["500000", 12, "0.02706", "13530.00"],
    ["400000", 6, "0.0123", "4920.00"],
    ["700000", 12, "0.02772", "19404.00"],
    ["300000", 12, "0.0264", "7920.00"],
    ["100000", 6, "0.012", "1200.00"],
  ] as const)("%s a %i meses: tasa %s, comisión %s", (monto, plazo, tasa, esperada) => {
    const c = comision("nueva", monto, plazo);
    expect(c.tasa.equals(tasa), `tasa ${c.tasa.toString()}`).toBe(true);
    expect(c.comision.toFixed(2)).toBe(esperada);
  });

  it("la tasa no se redondea: 1,500,000 a 12 meses usa 2.904%, no 2.90%", () => {
    const c = comision("nueva", "1500000", 12);
    expect(c.tasa.toFixed(5)).toBe("0.02904");
    // Con la tasa redondeada a 2.90% saldría 43,500.00.
    expect(c.comision.toFixed(2)).not.toBe("43500.00");
  });

  it("límite superior inclusivo: 300,000 cae en el primer tramo y 300,001 en el segundo", () => {
    const a = comision("nueva", "300000", 6);
    const b = comision("nueva", "300001", 6);
    expect([a.tramo.desde.toString(), a.tramo.hasta?.toString()]).toEqual(["30000", "300000"]);
    expect([b.tramo.desde.toString(), b.tramo.hasta?.toString()]).toEqual(["300001", "600000"]);
  });

  it("el último tramo no tiene tope: 50,000,000 a 18 meses usa 4.59%", () => {
    const c = comision("nueva", "50000000", 18);
    expect(c.tramo.hasta).toBeNull();
    expect(c.comision.toFixed(2)).toBe("2295000.00");
  });

  it("acepta centavos: 300,000.50 cae en el segundo tramo (más de 300,000)", () => {
    const c = comision("nueva", "300000.50", 6);
    expect(c.tramo.desde.toString()).toBe("300001");
    // 300,000.50 × 0.0123 = 3,690.00615 -> 3,690.01
    expect(c.comision.toFixed(2)).toBe("3690.01");
  });
});

describe("comisionDeInversion: renovaciones (N1)", () => {
  it.each([
    ["1000000", 6, "6450.00"],
    ["2000000", 12, "29700.00"],
    ["1600000", 24, "49680.00"],
    ["500000", 12, "6765.00"],
  ] as const)("%s a %i meses: comisión %s", (monto, plazo, esperada) => {
    expect(comision("renovacion", monto, plazo).comision.toFixed(2)).toBe(esperada);
  });
});

describe("comisionDeInversion: rechazos con mensaje en español", () => {
  it("monto menor a 30,000", () => {
    const e = mal(comisionDeInversion(s, { tipo: "nueva", monto: "29999.99", plazo: 12 }));
    expect(e.codigo).toBe("MONTO_MENOR_AL_MINIMO");
    expect(e.mensaje).toContain("$30,000.00");
    expect(e.mensaje).toContain("$29,999.99");
  });

  it("30,000 exactos sí pagan comisión", () => {
    expect(comision("nueva", "30000", 6).comision.toFixed(2)).toBe("360.00");
  });

  it.each([0, 3, 9, 36, 12.5])("plazo %s no existe en la tabla", (plazo) => {
    const e = mal(comisionDeInversion(s, { tipo: "nueva", monto: "100000", plazo }));
    expect(e.codigo).toBe("PLAZO_INVALIDO");
    expect(e.mensaje).toMatch(/6, 12, 18 y 24/);
  });

  it("moneda USD no tiene tabla de comisiones", () => {
    const e = mal(comisionDeInversion(s, { tipo: "nueva", monto: "100000", plazo: 12, moneda: "USD" }));
    expect(e.codigo).toBe("MONEDA_SIN_COMISION");
    expect(e.mensaje).toMatch(/USD/);
  });

  it.each(["", "abc", "-5", "1,000", "100000.123", "1e6"])("monto ilegible %j", (monto) => {
    const e = mal(comisionDeInversion(s, { tipo: "nueva", monto, plazo: 12 }));
    expect(e.codigo).toBe("MONTO_INVALIDO");
  });
});
