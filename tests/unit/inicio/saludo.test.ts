import { describe, expect, it } from "vitest";
import { fechaDeHoy, horaEnMexico, saludoPara } from "../../../src/componentes/inicio/saludo";

describe("saludo de la página de inicio", () => {
  it.each([
    [0, "Buenas noches"],
    [5, "Buenas noches"],
    [6, "Buenos días"],
    [11, "Buenos días"],
    [12, "Buenas tardes"],
    [18, "Buenas tardes"],
    [19, "Buenas noches"],
    [23, "Buenas noches"],
  ])("a las %i h dice «%s»", (hora, esperado) => {
    expect(saludoPara(hora)).toBe(esperado);
  });

  it("usa la hora de la Ciudad de México, no la del servidor", () => {
    // 2026-10-02 18:30 UTC = 12:30 en la Ciudad de México (UTC-6, sin horario de verano).
    expect(horaEnMexico(new Date("2026-10-02T18:30:00Z"))).toBe(12);
    expect(horaEnMexico(new Date("2026-10-03T03:00:00Z"))).toBe(21);
  });

  it("escribe la fecha en español de México con mayúscula inicial", () => {
    expect(fechaDeHoy(new Date("2026-10-02T18:30:00Z"))).toBe("Viernes 2 de octubre de 2026");
    // Ya es sábado en UTC, pero todavía viernes en la Ciudad de México.
    expect(fechaDeHoy(new Date("2026-10-03T03:00:00Z"))).toBe("Viernes 2 de octubre de 2026");
  });
});
