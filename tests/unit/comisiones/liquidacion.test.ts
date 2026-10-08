import { describe, expect, it } from "vitest";
import { liquidarMes, type EntradaLiquidacion, type InversionDelMes } from "../../../src/domain/comisiones/liquidacion";
import { bien, cargar, copiaSemilla, mal, semillaComisiones as s } from "./ayudas";

// Valores de referencia calculados fuera del motor (tabla N1, tasas completas).

const nueva = (monto: string, plazo: number, fecha = "2026-10-07"): InversionDelMes => ({ tipo: "nueva", monto, plazo, fecha });
const renovacion = (monto: string, plazo: number, fecha = "2026-10-07"): InversionDelMes => ({ tipo: "renovacion", monto, plazo, fecha });

const interno = (inversiones: InversionDelMes[], extra: Partial<EntradaLiquidacion> = {}) =>
  bien(liquidarMes(s, { perfil: "interno", rol: "EJECUTIVO", inversiones, ...extra }));
const externo = (inversiones: InversionDelMes[]) => bien(liquidarMes(s, { perfil: "externo", inversiones }));

const pesos = (d: { toFixed(n: number): string } | null) => (d === null ? null : d.toFixed(2));

describe("liquidarMes: interno", () => {
  it("mes desbloqueado: 500,000 a 12 (13,530.00) + 400,000 a 6 (4,920.00) = captación 900,000, pagable 18,450.00", () => {
    const l = interno([nueva("500000", 12), nueva("400000", 6, "2026-10-09")]);
    expect(l.lineas.map((x) => pesos(x.comision))).toEqual(["13530.00", "4920.00"]);
    expect(pesos(l.captacionParaMeta)).toBe("900000.00");
    expect(l.desbloqueo).toMatchObject({ desbloqueada: true });
    expect(pesos(l.desbloqueo!.meta)).toBe("1000000.00");
    expect(pesos(l.desbloqueo!.umbral)).toBe("800000.00");
    expect(pesos(l.comisionBruta)).toBe("18450.00");
    expect(pesos(l.comisionPagable)).toBe("18450.00");
    expect(pesos(l.comisionBloqueada)).toBe("0.00");
    expect(l.notaBloqueo).toBeNull();
  });

  it("mes bloqueado: 700,000 a 12 (19,404.00) < 800,000: pagable 0.00 y bloqueada 19,404.00 con la nota del parámetro", () => {
    const l = interno([nueva("700000", 12)]);
    expect(pesos(l.captacionParaMeta)).toBe("700000.00");
    expect(l.desbloqueo).toMatchObject({ desbloqueada: false, fecha: null });
    expect(pesos(l.comisionBruta)).toBe("19404.00");
    expect(pesos(l.comisionPagable)).toBe("0.00");
    expect(pesos(l.comisionBloqueada)).toBe("19404.00");
    expect(l.notaBloqueo).toBe("se_pierde (POR_CONFIRMAR, editable)");
    expect(l.pagos).toEqual([]);
  });

  it("las renovaciones no cuentan para la meta pero sí pagan comisión (cuando se desbloquea)", () => {
    const l = interno([nueva("700000", 12), renovacion("500000", 12)]);
    expect(pesos(l.captacionParaMeta)).toBe("700000.00");
    expect(l.lineas.map((x) => [x.cuentaParaMeta, pesos(x.comision)])).toEqual([
      [true, "19404.00"],
      [false, "6765.00"],
    ]);
    expect(l.desbloqueo!.desbloqueada).toBe(false);
    expect(pesos(l.comisionBruta)).toBe("26169.00");
    expect(pesos(l.comisionPagable)).toBe("0.00");
    expect(pesos(l.comisionBloqueada)).toBe("26169.00");
  });

  it("una renovación grande no desbloquea: 100,000 nueva + 1,000,000 renovación = captación 100,000", () => {
    const l = interno([nueva("100000", 12, "2026-10-03"), renovacion("1000000", 12, "2026-10-05")]);
    expect(pesos(l.captacionParaMeta)).toBe("100000.00");
    expect(l.desbloqueo).toMatchObject({ desbloqueada: false, fecha: null });
    expect(pesos(l.comisionPagable)).toBe("0.00");
    // Bono por captación: tampoco cuenta la renovación.
    expect(pesos(l.bono)).toBe("0.00");
  });

  it("la fecha de desbloqueo no la adelanta una renovación: renovación 800,000 el día 2 y nueva 800,000 el día 20", () => {
    const l = interno([renovacion("800000", 12, "2026-10-02"), nueva("800000", 12, "2026-10-20")]);
    expect(l.desbloqueo!.fecha).toBe("2026-10-20");
    expect(l.pagos.map((p) => p.fecha)).toEqual(["2026-11-01"]);
  });

  it("solo renovaciones por 2,500,000: sin bono (las renovaciones no cuentan para la captación del bono)", () => {
    const l = interno([renovacion("2500000", 12)]);
    expect(pesos(l.captacionParaMeta)).toBe("0.00");
    expect(pesos(l.bono)).toBe("0.00");
  });

  it("desbloqueado, también se paga la comisión de las renovaciones del mes", () => {
    const l = interno([nueva("900000", 12), renovacion("500000", 12)]);
    // 900,000 × 0.02772 = 24,948.00; renovación 6,765.00
    expect(pesos(l.comisionPagable)).toBe("31713.00");
  });

  it("el umbral exacto de 800,000 desbloquea", () => {
    const l = interno([nueva("800000", 12)]);
    expect(l.desbloqueo!.desbloqueada).toBe(true);
    expect(l.desbloqueo!.fecha).toBe("2026-10-07");
  });

  it("799,999.99 no desbloquea", () => {
    expect(interno([nueva("799999.99", 12)]).desbloqueo!.desbloqueada).toBe(false);
  });

  it("GERENTE: meta 2,000,000 (umbral 1,600,000), sin bono ni sueldo base hasta definirlo", () => {
    const l = bien(liquidarMes(s, { perfil: "interno", rol: "GERENTE", inversiones: [nueva("1500000", 12)] }));
    expect(pesos(l.desbloqueo!.meta)).toBe("2000000.00");
    expect(pesos(l.desbloqueo!.umbral)).toBe("1600000.00");
    expect(l.desbloqueo!.desbloqueada).toBe(false);
    expect(l.bono).toBeNull();
    expect(l.sueldoBase).toBeNull();
  });

  it("la red externa ya no cuenta para la meta: la entrada no la acepta y la liquidación no trae aporte (0.8.1)", () => {
    const l = interno([nueva("650000", 12, "2026-10-05")]);
    expect(pesos(l.captacionParaMeta)).toBe("650000.00");
    expect(l.desbloqueo!.desbloqueada).toBe(false);
    expect(l).not.toHaveProperty("aporteRed");
    // @ts-expect-error captacionRedExterna ya no existe en la entrada.
    const conRed = bien(liquidarMes(s, { perfil: "interno", rol: "EJECUTIVO", inversiones: [nueva("650000", 12)], captacionRedExterna: "500000" }));
    expect(pesos(conRed.captacionParaMeta)).toBe("650000.00");
  });
});

describe("liquidarMes: bono y sueldo base (EJECUTIVO, por captación para meta)", () => {
  it.each([
    ["900000", "0.00"],
    ["1000000", "0.00"],
    ["1499999", "0.00"],
    ["1500000", "5000.00"],
    ["1999999.99", "5000.00"],
    ["2000000", "10000.00"],
    ["5000000", "10000.00"],
  ])("captación %s: bono %s y sueldo base 15,000.00", (monto, bono) => {
    const l = interno([nueva(monto, 12)]);
    expect(pesos(l.bono)).toBe(bono);
    expect(pesos(l.sueldoBase)).toBe("15000.00");
  });

  it("el bono sale de incentivos_propuesta, no del código", () => {
    const j = copiaSemilla();
    j.incentivos_propuesta[1].bono = 7000;
    const l = bien(liquidarMes(cargar(j), { perfil: "interno", rol: "EJECUTIVO", inversiones: [nueva("1500000", 12)] }));
    expect(pesos(l.bono)).toBe("7000.00");
  });
});

describe("liquidarMes: externo", () => {
  it("todo es pagable, sin desbloqueo: nueva 500,000 a 12 -> 13,530.00", () => {
    const l = externo([nueva("500000", 12)]);
    expect(l.desbloqueo).toBeNull();
    expect(pesos(l.comisionPagable)).toBe("13530.00");
    expect(pesos(l.comisionBloqueada)).toBe("0.00");
    expect(l.bono).toBeNull();
    expect(pesos(l.sueldoBase)).toBe("0.00");
  });

  it("renovación 500,000 a 12 -> 6,765.00 pagable", () => {
    expect(pesos(externo([renovacion("500000", 12)]).comisionPagable)).toBe("6765.00");
  });

  it("cada inversión se paga en la fecha de su quincena", () => {
    const l = externo([nueva("500000", 12, "2026-10-03"), nueva("100000", 6, "2026-10-20"), renovacion("500000", 12, "2026-10-15")]);
    expect(l.pagos.map((p) => [p.fecha, pesos(p.monto), p.lineas])).toEqual([
      ["2026-10-16", "20295.00", [0, 2]],
      ["2026-11-01", "1200.00", [1]],
    ]);
  });

});

describe("liquidarMes: calendario de pagos del interno", () => {
  it("desbloquea el 12 (fecha D <= 15): lo captado hasta el 15 se paga el 16 y lo de después el día 1", () => {
    const l = interno([nueva("500000", 12, "2026-10-05"), nueva("300000", 12, "2026-10-12"), nueva("100000", 6, "2026-10-20")]);
    expect(l.lineas.map((x) => pesos(x.comision))).toEqual(["13530.00", "7920.00", "1200.00"]);
    expect(l.desbloqueo!.fecha).toBe("2026-10-12");
    expect(l.pagos.map((p) => [p.fecha, pesos(p.monto), p.lineas])).toEqual([
      ["2026-10-16", "21450.00", [0, 1]],
      ["2026-11-01", "1200.00", [2]],
    ]);
  });

  it("desbloquea el 20 (fecha D >= 16): todo se paga el día 1 del mes siguiente", () => {
    const l = interno([nueva("500000", 12, "2026-10-05"), nueva("300000", 12, "2026-10-20")]);
    expect(l.desbloqueo!.fecha).toBe("2026-10-20");
    expect(l.pagos.map((p) => [p.fecha, pesos(p.monto), p.lineas])).toEqual([["2026-11-01", "21450.00", [0, 1]]]);
  });

  it("el orden de captura no importa: se acumula en orden cronológico", () => {
    const l = interno([nueva("100000", 6, "2026-10-20"), nueva("300000", 12, "2026-10-12"), nueva("500000", 12, "2026-10-05")]);
    expect(l.desbloqueo!.fecha).toBe("2026-10-12");
    expect(l.pagos.map((p) => [p.fecha, p.lineas])).toEqual([
      ["2026-10-16", [1, 2]],
      ["2026-11-01", [0]],
    ]);
  });

  it("una renovación del día 3 se paga el 16 si el mes desbloquea el 12", () => {
    const l = interno([renovacion("500000", 12, "2026-10-03"), nueva("800000", 12, "2026-10-12")]);
    expect(l.pagos.map((p) => [p.fecha, p.lineas])).toEqual([["2026-10-16", [0, 1]]]);
  });

  it("diciembre: lo de la segunda quincena se paga el 1 de enero", () => {
    const l = interno([nueva("800000", 12, "2026-12-20")]);
    expect(l.pagos.map((p) => p.fecha)).toEqual(["2027-01-01"]);
  });
});

describe("liquidarMes: entradas", () => {
  it("un mes sin inversiones es válido y da ceros", () => {
    const l = interno([]);
    expect(pesos(l.comisionBruta)).toBe("0.00");
    expect(l.desbloqueo!.desbloqueada).toBe(false);
    expect(l.pagos).toEqual([]);
  });

  it("inversiones de meses distintos se rechazan", () => {
    const e = mal(liquidarMes(s, { perfil: "interno", rol: "EJECUTIVO", inversiones: [nueva("500000", 12, "2026-10-31"), nueva("500000", 12, "2026-11-01")] }));
    expect(e.codigo).toBe("MESES_MEZCLADOS");
  });

  it("el error de una inversión dice cuál es", () => {
    const e = mal(liquidarMes(s, { perfil: "interno", rol: "EJECUTIVO", inversiones: [nueva("500000", 12), nueva("20000", 12)] }));
    expect(e.codigo).toBe("MONTO_MENOR_AL_MINIMO");
    expect(e.mensaje).toMatch(/^Inversión 2:/);
  });

  it("interno sin rol se rechaza", () => {
    const e = mal(liquidarMes(s, { perfil: "interno", inversiones: [] }));
    expect(e.codigo).toBe("ENTRADA_INVALIDA");
  });

  it("con renovaciones_pagan_comision en false, la renovación queda en 0.00", () => {
    const j = copiaSemilla();
    (j.parametros as Record<string, unknown>).renovaciones_pagan_comision = false;
    const l = bien(liquidarMes(cargar(j), { perfil: "externo", inversiones: [renovacion("500000", 12)] }));
    expect(pesos(l.comisionPagable)).toBe("0.00");
  });
});
