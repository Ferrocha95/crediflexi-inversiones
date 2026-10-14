import { describe, expect, it } from "vitest";
import { liquidarMes, type InversionDelMes } from "../../../src/domain/comisiones/liquidacion";
import { totalEstimadoDelMes } from "../../../src/domain/comisiones/totalMes";
import { bien, semillaComisiones as s } from "./ayudas";

// Prueba de oro del "Total estimado del mes (simulación)" (Sprint 7a):
// sueldo base (solo EJECUTIVO) + comisión pagable + bono. Ni la comisión por
// externos ni el bono de gerente entran (decisión de Fernando). Valores de
// referencia calculados fuera del motor con la tabla N1 de la semilla:
//   1,000,000 a 12 meses: 1,000,000 × 2.838% = 28,380.00; bono 0 (fila "100% de la meta").
//   1,000,000 a 24 meses: 1,000,000 × 5.934% = 59,340.00.
//   1,500,000 a 12 meses: 1,500,000 × 2.904% = 43,560.00; bono 5,000 (fila "150% de la meta").
// Sueldo base del EJECUTIVO: 15,000 (propuesta). Desbloqueo: 80% de 1,000,000 = 800,000.

const una = (monto: string, plazo: number): InversionDelMes[] => [{ tipo: "nueva", monto, plazo, fecha: "2026-10-07" }];
const pesos = (d: { toFixed: (n: number) => string }) => d.toFixed(2);

function ejecutivo(monto: string, plazo: number) {
  return bien(liquidarMes(s, { perfil: "interno", rol: "EJECUTIVO", inversiones: una(monto, plazo) }));
}

describe("totalEstimadoDelMes (EJECUTIVO, una sola inversión nueva)", () => {
  it.each([
    ["1000000", 12, "28380.00", "0.00", "43380.00"],
    ["1000000", 24, "59340.00", "0.00", "74340.00"],
    ["1500000", 12, "43560.00", "5000.00", "63560.00"],
  ])("captación %s a %i meses: comisión %s, bono %s, total %s", (monto, plazo, comision, bono, total) => {
    const l = ejecutivo(monto, plazo);
    const t = totalEstimadoDelMes(l);
    expect([pesos(t.sueldoBase!), pesos(t.comisionPagable), pesos(t.bono!), pesos(t.total)]).toEqual(["15000.00", comision, bono, total]);
  });

  it("1,500,000 a 12 meses usa la tasa completa 2.904%", () => {
    expect(ejecutivo("1500000", 12).lineas[0].tasa.toString()).toBe("0.02904");
  });

  it("800,000 desbloquea: la comisión entra al total", () => {
    const l = ejecutivo("800000", 12);
    expect(l.desbloqueo?.desbloqueada).toBe(true);
    const t = totalEstimadoDelMes(l);
    expect(pesos(t.total)).toBe(pesos(t.sueldoBase!.plus(t.comisionPagable)));
    expect(t.comisionPagable.isZero()).toBe(false);
  });

  it("799,999.99 no desbloquea: el total es solo el sueldo base", () => {
    const l = ejecutivo("799999.99", 12);
    expect(l.desbloqueo?.desbloqueada).toBe(false);
    const t = totalEstimadoDelMes(l);
    expect([pesos(t.comisionPagable), pesos(t.bono!), pesos(t.total)]).toEqual(["0.00", "0.00", "15000.00"]);
  });
});

describe("totalEstimadoDelMes: GERENTE y externo", () => {
  it("GERENTE: sin sueldo base ni bono por captación; el total es la comisión pagable", () => {
    const l = bien(liquidarMes(s, { perfil: "interno", rol: "GERENTE", inversiones: una("2000000", 12) }));
    const t = totalEstimadoDelMes(l);
    expect([t.sueldoBase, t.bono]).toEqual([null, null]);
    expect(pesos(t.total)).toBe(pesos(l.comisionPagable));
  });

  it("externo, 1,000,000 a 12 meses: comisión 28,380.00 más bono 15,000.00, sin sueldo base", () => {
    const l = bien(liquidarMes(s, { perfil: "externo", inversiones: una("1000000", 12) }));
    const t = totalEstimadoDelMes(l);
    expect(t.sueldoBase).toBeNull();
    expect([pesos(t.comisionPagable), pesos(t.bono!), pesos(t.total)]).toEqual(["28380.00", "15000.00", "43380.00"]);
  });
});
