import { describe, expect, it } from "vitest";
import type { SolicitudComision } from "../../../src/domain/comisiones/comision";
import { comisionPorRedExterna } from "../../../src/domain/comisiones/redExterna";
import { bien, cargar, copiaSemilla, mal, semillaComisiones as s } from "./ayudas";

// Comisión por externos (supuesto por confirmar, parametros.red_externa): el
// 30% de la suma de las comisiones N1 de las inversiones de los externos de un
// interno, nuevas y renovaciones. Cada comisión con la misma función de la
// comisión N1; la suma a 2 decimales y un solo redondeo final. Queda sujeta al
// desbloqueo del propio interno. Valores de referencia calculados aparte por Fernando.

const nueva = (monto: string, plazo: number): SolicitudComision => ({ tipo: "nueva", monto, plazo });
const renovacion = (monto: string, plazo: number): SolicitudComision => ({ tipo: "renovacion", monto, plazo });

const pesos = (d: { toFixed(n: number): string }) => d.toFixed(2);

describe("comisionPorRedExterna", () => {
  it("13,530.00 + 4,920.00 + 6,765.00: base 25,215.00 y 30% = 7,564.50, pagable si el interno desbloquea", () => {
    const r = bien(comisionPorRedExterna(s, [nueva("500000", 12), nueva("400000", 6), renovacion("500000", 12)], true));
    expect(r.lineas.map((l) => pesos(l.comision))).toEqual(["13530.00", "4920.00", "6765.00"]);
    expect(pesos(r.base)).toBe("25215.00");
    expect(r.porcentaje.toString()).toBe("0.3");
    expect(pesos(r.comision)).toBe("7564.50");
    expect(r.desbloqueada).toBe(true);
    expect(pesos(r.pagable)).toBe("7564.50");
    expect(pesos(r.bloqueada)).toBe("0.00");
  });

  it("una sola nueva de 300,001 a 6 meses (3,690.01): 30% = 1,107.00", () => {
    const r = bien(comisionPorRedExterna(s, [nueva("300001", 6)], true));
    expect(pesos(r.base)).toBe("3690.01");
    expect(pesos(r.comision)).toBe("1107.00");
  });

  it("dos nuevas de 300,001 a 6 meses: 7,380.02 × 0.30 = 2,214.006 -> 2,214.01 con UN solo redondeo (por inversión daría 2,214.00)", () => {
    const r = bien(comisionPorRedExterna(s, [nueva("300001", 6), nueva("300001", 6)], true));
    expect(pesos(r.base)).toBe("7380.02");
    expect(pesos(r.comision)).toBe("2214.01");
  });

  it("interno bloqueado (captación nueva propia de 700,000 < 800,000): los 7,564.50 quedan bloqueados y lo pagable es 0.00", () => {
    const r = bien(comisionPorRedExterna(s, [nueva("500000", 12), nueva("400000", 6), renovacion("500000", 12)], false));
    expect(pesos(r.comision)).toBe("7564.50");
    expect(r.desbloqueada).toBe(false);
    expect(pesos(r.pagable)).toBe("0.00");
    expect(pesos(r.bloqueada)).toBe("7564.50");
  });

  it("sin inversiones de externos: todo en cero", () => {
    const r = bien(comisionPorRedExterna(s, [], true));
    expect([pesos(r.base), pesos(r.comision), pesos(r.pagable), pesos(r.bloqueada)]).toEqual(["0.00", "0.00", "0.00", "0.00"]);
  });

  it("con requiere_desbloqueo_del_interno en false se paga aunque el interno no desbloquee", () => {
    const j = copiaSemilla();
    j.parametros.red_externa.requiere_desbloqueo_del_interno = false;
    const r = bien(comisionPorRedExterna(cargar(j), [nueva("300001", 6)], false));
    expect(r.desbloqueada).toBe(true);
    expect(pesos(r.pagable)).toBe("1107.00");
    expect(pesos(r.bloqueada)).toBe("0.00");
  });

  it("el porcentaje sale de la semilla (parametros.red_externa.porcentaje)", () => {
    const j = copiaSemilla();
    j.parametros.red_externa.porcentaje = "0.25";
    expect(pesos(bien(comisionPorRedExterna(cargar(j), [nueva("500000", 12)], true)).comision)).toBe("3382.50");
  });

  it("no cambia el bono de gerente: cada uno lee su propio porcentaje", () => {
    const j = copiaSemilla();
    j.parametros.red_externa.porcentaje = "0.10";
    const semilla = cargar(j);
    expect(semilla.bonoGerente.porcentaje.toString()).toBe("0.3");
    expect(pesos(bien(comisionPorRedExterna(semilla, [nueva("500000", 12)], true)).comision)).toBe("1353.00");
  });

  it("un error de una inversión dice cuál es", () => {
    const e = mal(comisionPorRedExterna(s, [nueva("500000", 12), nueva("20000", 12)], true));
    expect(e.codigo).toBe("MONTO_MENOR_AL_MINIMO");
    expect(e.mensaje).toMatch(/^Inversión de tus externos 2:/);
  });
});
