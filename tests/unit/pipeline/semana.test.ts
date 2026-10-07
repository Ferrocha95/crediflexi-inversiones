import { describe, expect, it } from "vitest";
import { mesDelViernes, rangoSemanaEnTexto, semanaActual, semanaDe, semanasRecientes } from "../../../src/aplicacion/pipeline/semana";

describe("semanaDe: lunes a viernes", () => {
  it.each([
    ["2026-09-28", "2026-09-28", "2026-10-02"],
    ["2026-10-01", "2026-09-28", "2026-10-02"],
    ["2026-10-02", "2026-09-28", "2026-10-02"],
    ["2026-10-07", "2026-10-05", "2026-10-09"],
    ["2026-10-12", "2026-10-12", "2026-10-16"],
  ])("%s -> %s a %s", (dia, lunes, viernes) => {
    expect(semanaDe(dia)).toEqual({ lunes, viernes });
  });

  it("sábado y domingo usan la semana que acaba de terminar", () => {
    expect(semanaDe("2026-10-03")).toEqual({ lunes: "2026-09-28", viernes: "2026-10-02" });
    expect(semanaDe("2026-10-04")).toEqual({ lunes: "2026-09-28", viernes: "2026-10-02" });
  });

  it("cruce de año", () => {
    expect(semanaDe("2025-12-31")).toEqual({ lunes: "2025-12-29", viernes: "2026-01-02" });
    expect(semanaDe("2026-01-03")).toEqual({ lunes: "2025-12-29", viernes: "2026-01-02" });
  });
});

describe("semanaActual en America/Mexico_City", () => {
  it("miércoles 7 de octubre de 2026", () => {
    expect(semanaActual(new Date("2026-10-07T18:00:00Z"))).toEqual({ lunes: "2026-10-05", viernes: "2026-10-09" });
  });

  it("domingo 11 a las 23:59 en la Ciudad de México (ya lunes en UTC) sigue en la semana que terminó", () => {
    expect(semanaActual(new Date("2026-10-12T05:59:00Z"))).toEqual({ lunes: "2026-10-05", viernes: "2026-10-09" });
  });

  it("lunes 12 a las 00:00 en la Ciudad de México empieza la semana nueva", () => {
    expect(semanaActual(new Date("2026-10-12T06:00:00Z"))).toEqual({ lunes: "2026-10-12", viernes: "2026-10-16" });
  });
});

describe("rangoSemanaEnTexto y mesDelViernes", () => {
  it("cruce de mes", () => {
    const s = semanaDe("2026-09-30");
    expect(rangoSemanaEnTexto(s)).toBe("28 DE SEPTIEMBRE A 2 DE OCTUBRE 2026");
    expect(mesDelViernes(s)).toBe("OCTUBRE");
  });

  it("mismo mes: nombra el mes dos veces", () => {
    const s = semanaDe("2026-10-07");
    expect(rangoSemanaEnTexto(s)).toBe("5 DE OCTUBRE A 9 DE OCTUBRE 2026");
    expect(mesDelViernes(s)).toBe("OCTUBRE");
  });

  it("cruce de año: nombra los dos años", () => {
    const s = semanaDe("2025-12-30");
    expect(rangoSemanaEnTexto(s)).toBe("29 DE DICIEMBRE 2025 A 2 DE ENERO 2026");
    expect(mesDelViernes(s)).toBe("ENERO");
  });
});

describe("semanasRecientes", () => {
  it("la actual primero y luego las anteriores", () => {
    expect(semanasRecientes({ lunes: "2026-10-05", viernes: "2026-10-09" }, 3)).toEqual([
      { lunes: "2026-10-05", viernes: "2026-10-09" },
      { lunes: "2026-09-28", viernes: "2026-10-02" },
      { lunes: "2026-09-21", viernes: "2026-09-25" },
    ]);
  });
});
