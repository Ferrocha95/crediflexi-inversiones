import { describe, expect, it } from "vitest";
import { fechaDeTextoIso, fechaEnMexico, fechaIsoEnMexico } from "../../../src/aplicacion/fecha";

describe("fechaDeTextoIso", () => {
  it("corta el texto AAAA-MM-DD a DD/MM/AAAA", () => {
    expect(fechaDeTextoIso("2026-10-01")).toBe("01/10/2026");
    expect(fechaDeTextoIso("2027-01-31")).toBe("31/01/2027");
  });

  it("no pasa por Date: una fecha inexistente se corta igual", () => {
    // La semilla ya valida que generado sea una fecha real (z.iso.date).
    expect(fechaDeTextoIso("2026-02-30")).toBe("30/02/2026");
  });

  it.each(["2026-10-1", "01/10/2026", "2026-10-01T00:00:00Z", ""])("rechaza %j", (texto) => {
    expect(() => fechaDeTextoIso(texto)).toThrow(/AAAA-MM-DD/);
  });
});

describe("fechaEnMexico", () => {
  it("formatea DD/MM/AAAA en la zona de la Ciudad de México", () => {
    expect(fechaEnMexico(new Date("2026-10-01T18:00:00Z"))).toBe("01/10/2026");
  });

  it("antes de las 06:00 UTC todavía es el día anterior en México", () => {
    expect(fechaEnMexico(new Date("2026-10-01T05:30:00Z"))).toBe("30/09/2026");
  });
});

describe("fechaIsoEnMexico", () => {
  it("da AAAA-MM-DD en la zona de la Ciudad de México", () => {
    expect(fechaIsoEnMexico(new Date("2026-10-01T18:00:00Z"))).toBe("2026-10-01");
  });

  it("antes de las 06:00 UTC todavía es el día anterior en México", () => {
    expect(fechaIsoEnMexico(new Date("2026-10-01T05:30:00Z"))).toBe("2026-09-30");
  });
});
