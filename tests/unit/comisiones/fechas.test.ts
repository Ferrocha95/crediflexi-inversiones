import { describe, expect, it } from "vitest";
import { fechaDePagoComision } from "../../../src/domain/comisiones/fechas";
import { bien, mal, semillaComisiones as s } from "./ayudas";

// Calendario de pago (parametros.pago_comisiones): del día 1 al 15 se paga el
// 16 del mismo mes; del 16 a fin de mes, el día 1 del mes siguiente. Las
// fechas van como texto AAAA-MM-DD y ninguna zona horaria puede mover el día.

describe("fechaDePagoComision", () => {
  it.each([
    ["2026-10-07", "2026-10-16"],
    ["2026-10-15", "2026-10-16"],
    ["2026-10-16", "2026-11-01"],
    ["2026-10-31", "2026-11-01"],
    ["2026-12-20", "2027-01-01"],
    ["2026-10-01", "2026-10-16"],
    ["2028-02-29", "2028-03-01"],
    ["2026-12-15", "2026-12-16"],
  ])("captación %s se paga %s", (fecha, pago) => {
    expect(bien(fechaDePagoComision(s, fecha))).toBe(pago);
  });

  it.each(["2026-02-30", "2026-13-01", "2026-10-7", "07/10/2026", "", "2026-00-10", "2027-02-29"])("rechaza la fecha %j", (fecha) => {
    const e = mal(fechaDePagoComision(s, fecha));
    expect(e.codigo).toBe("FECHA_INVALIDA");
    expect(e.mensaje).toMatch(/AAAA-MM-DD/);
  });

  it("no depende de la zona horaria del proceso", () => {
    const antes = process.env.TZ;
    try {
      for (const tz of ["America/Mexico_City", "Pacific/Kiritimati", "Etc/GMT+12", "UTC"]) {
        process.env.TZ = tz;
        expect(bien(fechaDePagoComision(s, "2026-10-15"))).toBe("2026-10-16");
        expect(bien(fechaDePagoComision(s, "2026-10-31"))).toBe("2026-11-01");
      }
    } finally {
      if (antes === undefined) delete process.env.TZ;
      else process.env.TZ = antes;
    }
  });
});
