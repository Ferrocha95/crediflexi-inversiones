import { describe, expect, it } from "vitest";
import { modeloComisiones, opcionesComisiones, plazosDeComision, porcentajeComision, type CamposComisiones } from "../../../src/aplicacion/comisiones";
import { Decimal } from "../../../src/domain/comun/decimal";
import { semillaComisiones as s } from "../comisiones/ayudas";

// El modelo de la pantalla /comisiones: solo texto. Las cifras de referencia
// son las mismas del motor (tabla N1), calculadas fuera de él.

type Inversion = CamposComisiones["inversiones"][number];
const nueva = (monto: string, plazo: number | null, fecha = "2026-10-07"): Inversion => ({ tipo: "nueva", monto, plazo, fecha });

const INTERNO: CamposComisiones = { perfil: "interno", rol: "EJECUTIVO", inversiones: [], equipo: [], externos: [] };
type DelEquipo = CamposComisiones["equipo"][number];
const delEquipo = (tipo: DelEquipo["tipo"], monto: string, plazo: number | null): DelEquipo => ({ tipo, monto, plazo });
type DeExterno = CamposComisiones["externos"][number];
const deExterno = (tipo: DeExterno["tipo"], monto: string, plazo: number | null): DeExterno => ({ tipo, monto, plazo });
/** Las inversiones de los externos de un interno (valores de referencia de Fernando). */
const TRES_DE_EXTERNOS = [deExterno("nueva", "500,000", 12), deExterno("nueva", "400000", 6), deExterno("renovacion", "500000", 12)];

function modelo(c: Partial<CamposComisiones>) {
  const r = modeloComisiones(s, { ...INTERNO, ...c });
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

function error(c: Partial<CamposComisiones>) {
  const r = modeloComisiones(s, { ...INTERNO, ...c });
  if (r.ok) throw new Error("Se esperaba un error");
  return r.error;
}

describe("porcentajeComision: la tasa completa con hasta 3 decimales", () => {
  it.each([
    ["0.02904", "2.904%"],
    ["0.05658", "5.658%"],
    ["0.0123", "1.23%"],
    ["0.012", "1.20%"],
    ["0.00645", "0.645%"],
    ["0.0212175", "2.122%"],
  ])("%s -> %s", (tasa, texto) => {
    expect(porcentajeComision(new Decimal(tasa))).toBe(texto);
  });
});

describe("modeloComisiones: interno", () => {
  it("mes desbloqueado: líneas con tasa, cálculo y fecha de pago; totales y avance", () => {
    const m = modelo({ inversiones: [nueva("500,000", 12), nueva("400000", 6, "2026-10-09")] });
    expect(m.lineas.map((l) => [l.numero, l.monto, l.plazo, l.tasa, l.comision, l.fecha, l.fechaPago])).toEqual([
      [1, "$500,000.00", "12 meses", "2.706%", "$13,530.00", "07/10/2026", "16/10/2026"],
      [2, "$400,000.00", "6 meses", "1.23%", "$4,920.00", "09/10/2026", "16/10/2026"],
    ]);
    expect(m.lineas[0].operacion).toBe("$500,000.00 × 2.706% = $13,530.00");
    expect(m.totales).toMatchObject({
      comisionBruta: "$18,450.00",
      comisionPagable: "$18,450.00",
      comisionBloqueada: "$0.00",
      captacionParaMeta: "$900,000.00",
    });
    expect(m.avance).toMatchObject({
      meta: "$1,000,000.00",
      umbral: "$800,000.00",
      porcentaje: "90%",
      porcentajeUmbral: "80%",
      desbloqueada: true,
      fechaDesbloqueo: "09/10/2026",
      faltaParaUmbral: null,
      faltaParaMeta: "$100,000.00",
    });
    expect(m.avance!.fraccion).toBeCloseTo(0.9, 10);
    expect(m.avance!.fraccionUmbral).toBeCloseTo(0.8, 10);
    expect(m.pagos).toEqual([{ fecha: "16/10/2026", monto: "$18,450.00", inversiones: [1, 2] }]);
    expect(m.bono).toBe("$0.00");
    expect(m.sueldoBase).toBe("$15,000");
    expect(m.notaBloqueo).toBeNull();
  });

  it("mes bloqueado: pagable $0.00, bloqueada, cuánto falta y la regla del cierre sin guiones bajos", () => {
    const m = modelo({ inversiones: [nueva("700000", 12)] });
    expect(m.totales.comisionPagable).toBe("$0.00");
    expect(m.totales.comisionBloqueada).toBe("$19,404.00");
    expect(m.avance).toMatchObject({ desbloqueada: false, porcentaje: "70%", faltaParaUmbral: "$100,000.00", fechaDesbloqueo: null });
    expect(m.lineas[0].fechaPago).toBeNull();
    expect(m.pagos).toEqual([]);
    expect(m.notaBloqueo).toBe("se pierde (POR_CONFIRMAR, editable)");
  });

  it("el porcentaje se trunca: 799,999.99 es 79%, no 80%", () => {
    expect(modelo({ inversiones: [nueva("799999.99", 12)] }).avance!.porcentaje).toBe("79%");
  });

  it("más del 100%: la fracción del dibujo se queda en 1 y el porcentaje dice la verdad", () => {
    const m = modelo({ inversiones: [nueva("2500000", 12)] });
    expect(m.avance!.porcentaje).toBe("250%");
    expect(m.avance!.fraccion).toBe(1);
    expect(m.avance!.faltaParaMeta).toBeNull();
    expect(m.bono).toBe("$10,000.00");
  });

  it("la red externa ya no existe en el modelo (0.8.1)", () => {
    const m = modelo({ inversiones: [nueva("650000", 12)] });
    expect(m.totales).not.toHaveProperty("aporteRed");
    expect(m.totales.captacionParaMeta).toBe("$650,000.00");
  });

  it("GERENTE: sin bono por captación ni sueldo base; la meta es sobre su propia captación", () => {
    const m = modelo({ rol: "GERENTE", inversiones: [nueva("500000", 12)] });
    expect(m.bono).toBeNull();
    expect(m.sueldoBase).toBeNull();
    expect(m.avance!.meta).toBe("$2,000,000.00");
    expect(m.totales.captacionParaMeta).toBe("$500,000.00");
    expect(m.bonoGerente).toBeNull();
  });

  it("GERENTE con inversiones del equipo: bono de gerente aparte (base 25,215.00, bono 7,564.50)", () => {
    const m = modelo({
      rol: "GERENTE",
      inversiones: [nueva("500000", 12)],
      equipo: [delEquipo("nueva", "500,000", 12), delEquipo("nueva", "400000", 6), delEquipo("renovacion", "500000", 12)],
    });
    expect(m.bonoGerente).toEqual({
      base: "$25,215.00",
      porcentaje: "30%",
      bono: "$7,564.50",
      lineas: [
        { numero: 1, tipo: "nueva", monto: "$500,000.00", plazo: "12 meses", tasa: "2.706%", comision: "$13,530.00" },
        { numero: 2, tipo: "nueva", monto: "$400,000.00", plazo: "6 meses", tasa: "1.23%", comision: "$4,920.00" },
        { numero: 3, tipo: "renovacion", monto: "$500,000.00", plazo: "12 meses", tasa: "1.353%", comision: "$6,765.00" },
      ],
      operacion: "30% × $25,215.00 = $7,564.50",
    });
    // El bono del equipo no cambia la meta ni la comisión propia del gerente.
    expect(m.totales.captacionParaMeta).toBe("$500,000.00");
    expect(m.totales.comisionBruta).toBe("$13,530.00");
  });

  it("GERENTE con una sola nueva del equipo de 300,001 a 6 meses: bono 1,107.00", () => {
    const m = modelo({ rol: "GERENTE", equipo: [delEquipo("nueva", "300001", 6)] });
    expect(m.bonoGerente).toMatchObject({ base: "$3,690.01", bono: "$1,107.00" });
  });

  it("EJECUTIVO: el sueldo base de la propuesta aparece; el bono de gerente no", () => {
    const m = modelo({ inversiones: [nueva("500000", 12)] });
    expect(m.sueldoBase).toBe("$15,000");
    expect(m.bonoGerente).toBeNull();
  });

  it("trae la regla de pago de la semilla para escribirla en pantalla", () => {
    expect(modelo({}).regla).toEqual({ ultimoDiaQuincena1: 15, diaPagoQuincena1: 16, diaPagoQuincena2: 1 });
  });
});

describe("modeloComisiones: externo", () => {
  it("sin avance, sin rol, todo pagable en su quincena", () => {
    const m = modelo({ perfil: "externo", rol: null, inversiones: [nueva("500000", 12, "2026-10-20")] });
    expect(m.avance).toBeNull();
    expect(m.totales.comisionPagable).toBe("$13,530.00");
    // Un externo no tiene desbloqueo: el modelo no trae comisión bloqueada.
    expect(m.totales.comisionBloqueada).toBeNull();
    expect(m.pagos).toEqual([{ fecha: "01/11/2026", monto: "$13,530.00", inversiones: [1] }]);
    // El sueldo base solo se muestra al perfil interno con rol EJECUTIVO.
    expect(m.sueldoBase).toBeNull();
    // Bono de externos (Sprint 5): 500,000 de captación nueva no llega a 1,000,000.
    expect(m.bono).toBe("$0.00");
    expect(m.bonoGerente).toBeNull();
  });
});

describe("modeloComisiones: errores en español que dicen qué inversión", () => {
  it("monto ilegible", () => {
    expect(error({ inversiones: [nueva("500000", 12), nueva("abc", 12)] }).mensaje).toMatch(/^Inversión 2: /);
  });

  it("monto vacío", () => {
    expect(error({ inversiones: [nueva("", 12)] }).mensaje).toMatch(/^Inversión 1: .*monto/i);
  });

  it("sin plazo", () => {
    expect(error({ inversiones: [nueva("500000", null)] }).mensaje).toBe("Inversión 1: elige el plazo.");
  });

  it("monto menor al mínimo (mensaje del motor)", () => {
    expect(error({ inversiones: [nueva("20,000", 12)] }).mensaje).toMatch(/^Inversión 1: .*\$30,000\.00/);
  });

  it("interno sin rol", () => {
    expect(error({ rol: null }).mensaje).toMatch(/rol/);
  });

  it("inversiones del equipo con un rol que no es GERENTE", () => {
    expect(error({ rol: "EJECUTIVO", equipo: [delEquipo("nueva", "500000", 12)] }).mensaje).toMatch(/Gerente/);
    expect(error({ perfil: "externo", rol: null, equipo: [delEquipo("nueva", "500000", 12)] }).mensaje).toMatch(/Gerente/);
  });

  it("una inversión del equipo ilegible, sin plazo o menor al mínimo dice cuál es", () => {
    expect(error({ rol: "GERENTE", equipo: [delEquipo("nueva", "abc", 12)] }).mensaje).toMatch(/^Inversión del equipo 1: /);
    expect(error({ rol: "GERENTE", equipo: [delEquipo("nueva", "500000", 12), delEquipo("nueva", "500000", null)] }).mensaje).toBe(
      "Inversión del equipo 2: elige el plazo.",
    );
    expect(error({ rol: "GERENTE", equipo: [delEquipo("nueva", "20,000", 12)] }).mensaje).toMatch(/^Inversión del equipo 1: .*\$30,000\.00/);
  });
});

describe("plazosDeComision", () => {
  it("salen de la tabla del nivel vigente", () => {
    expect(plazosDeComision(s)).toEqual([6, 12, 18, 24]);
  });
});

describe("opcionesComisiones", () => {
  it("los plazos salen de la semilla (ya sin el porcentaje de la red)", () => {
    expect(opcionesComisiones(s)).toEqual({ plazos: [6, 12, 18, 24] });
  });
});

describe("modeloComisiones: tabla de incentivos del externo (Sprint 6c)", () => {
  const externo = (monto: string, extra: Inversion[] = []) =>
    modelo({ perfil: "externo", rol: null, inversiones: [nueva(monto, 12), ...extra] });

  it("cumplimiento, desde, hasta e incentivo de las filas EXTERNOS; resalta la de 1,000,000 de captación nueva", () => {
    const m = externo("1,000,000");
    expect(m.incentivos).toEqual({
      tipo: "externo",
      filas: [
        { cumplimiento: "100% de la meta interna", desde: "$1,000,000", hasta: "$1,499,999", bono: "$15,000", alcanzada: true },
        { cumplimiento: "150% de la meta interna", desde: "$1,500,000", hasta: "$1,999,999", bono: "$20,000", alcanzada: false },
        { cumplimiento: "200% de la meta interna", desde: "$2,000,000", hasta: null, bono: "$25,000", alcanzada: false },
      ],
      metaReferencia: "$1,000,000",
      desbloqueo: null,
    });
  });

  it.each([
    ["999,999.99", [false, false, false]],
    ["1,500,000", [false, true, false]],
    ["2,000,000", [false, false, true]],
  ])("captación nueva %s: filas resaltadas %j", (monto, resaltadas) => {
    expect(externo(monto).incentivos!.filas.map((f) => f.alcanzada)).toEqual(resaltadas);
  });

  it("el rango se mide con la captación NUEVA: 1,500,000 nueva + 1,000,000 de renovación resalta 150%", () => {
    const m = externo("1,500,000", [{ tipo: "renovacion", monto: "1000000", plazo: 12, fecha: "2026-10-07" }]);
    expect(m.incentivos!.filas.map((f) => f.alcanzada)).toEqual([false, true, false]);
  });

  it("la meta de referencia sale de la semilla (metas_mensuales.EJECUTIVO)", () => {
    expect(externo("500000").incentivos!.metaReferencia).toBe("$1,000,000");
  });
});

describe("modeloComisiones: tabla de metas del EJECUTIVO (Sprint 6c)", () => {
  it("filas INTERNOS con bono $0, $5,000 y $10,000; resalta la alcanzada; sueldo base y desbloqueo al 80% ($800,000)", () => {
    const m = modelo({ inversiones: [nueva("1,500,000", 12)] });
    expect(m.incentivos).toEqual({
      tipo: "interno",
      filas: [
        { cumplimiento: "100% de la meta", desde: "$1,000,000", hasta: "$1,499,999", bono: "$0", alcanzada: false },
        { cumplimiento: "150% de la meta", desde: "$1,500,000", hasta: "$1,999,999", bono: "$5,000", alcanzada: true },
        { cumplimiento: "200% de la meta", desde: "$2,000,000", hasta: null, bono: "$10,000", alcanzada: false },
      ],
      metaReferencia: null,
      desbloqueo: { porcentaje: "80%", umbral: "$800,000" },
    });
    expect(m.sueldoBase).toBe("$15,000");
  });

  it("debajo de 1,000,000 no se resalta ninguna fila", () => {
    expect(modelo({ inversiones: [nueva("999,999.99", 12)] }).incentivos!.filas.every((f) => !f.alcanzada)).toBe(true);
  });

  it("las renovaciones no cuentan para la fila: 900,000 nueva + 1,000,000 de renovación no llega al 100%", () => {
    const m = modelo({ inversiones: [nueva("900000", 12), { tipo: "renovacion", monto: "1000000", plazo: 12, fecha: "2026-10-07" }] });
    expect(m.incentivos!.filas.every((f) => !f.alcanzada)).toBe(true);
  });

  it("GERENTE: sin tabla de metas", () => {
    expect(modelo({ rol: "GERENTE", inversiones: [nueva("2,500,000", 12)] }).incentivos).toBeNull();
  });
});

describe("modeloComisiones: Mis externos, comisión por externos (30%, supuesto por confirmar)", () => {
  it("interno desbloqueado (900,000 propios): 25,215.00 × 30% = 7,564.50 pagable, aparte de su comisión", () => {
    const m = modelo({ inversiones: [nueva("500000", 12), nueva("400000", 6)], externos: TRES_DE_EXTERNOS });
    expect(m.redExterna).toEqual({
      lineas: [
        { numero: 1, tipo: "nueva", monto: "$500,000.00", plazo: "12 meses", tasa: "2.706%", comision: "$13,530.00" },
        { numero: 2, tipo: "nueva", monto: "$400,000.00", plazo: "6 meses", tasa: "1.23%", comision: "$4,920.00" },
        { numero: 3, tipo: "renovacion", monto: "$500,000.00", plazo: "12 meses", tasa: "1.353%", comision: "$6,765.00" },
      ],
      base: "$25,215.00",
      porcentaje: "30%",
      comision: "$7,564.50",
      operacion: "30% × $25,215.00 = $7,564.50",
      desbloqueada: true,
      pagable: "$7,564.50",
      bloqueada: "$0.00",
      umbral: "$800,000",
      notaBloqueo: null,
    });
    // No se mezcla con la comisión propia ni con la meta.
    expect(m.totales.comisionBruta).toBe("$18,450.00");
    expect(m.totales.captacionParaMeta).toBe("$900,000.00");
  });

  it("interno bloqueado (700,000 propios < 800,000): los 7,564.50 quedan bloqueados, pagable 0.00, con la nota del cierre", () => {
    const m = modelo({ inversiones: [nueva("700000", 12)], externos: TRES_DE_EXTERNOS });
    expect(m.redExterna).toMatchObject({
      comision: "$7,564.50",
      desbloqueada: false,
      pagable: "$0.00",
      bloqueada: "$7,564.50",
      umbral: "$800,000",
      notaBloqueo: "se pierde (POR_CONFIRMAR, editable)",
    });
  });

  it("dos nuevas de 300,001 a 6 meses: un solo redondeo final, $2,214.01", () => {
    const m = modelo({ inversiones: [nueva("800000", 12)], externos: [deExterno("nueva", "300,001", 6), deExterno("nueva", "300001", 6)] });
    expect(m.redExterna).toMatchObject({ base: "$7,380.02", comision: "$2,214.01" });
  });

  it("una sola nueva de 300,001 a 6 meses: $1,107.00", () => {
    expect(modelo({ inversiones: [nueva("800000", 12)], externos: [deExterno("nueva", "300001", 6)] }).redExterna!.comision).toBe("$1,107.00");
  });

  it("GERENTE: el bloqueo se mide con su propio umbral ($1,600,000) y el bono de gerente no cambia ni se mezcla", () => {
    const m = modelo({
      rol: "GERENTE",
      inversiones: [nueva("500000", 12)],
      equipo: [delEquipo("nueva", "500,000", 12), delEquipo("nueva", "400000", 6), delEquipo("renovacion", "500000", 12)],
      externos: [deExterno("nueva", "300001", 6)],
    });
    expect(m.bonoGerente).toMatchObject({ base: "$25,215.00", bono: "$7,564.50" });
    expect(m.redExterna).toMatchObject({ base: "$3,690.01", comision: "$1,107.00", desbloqueada: false, umbral: "$1,600,000" });
  });

  it("sin inversiones de externos no hay bloque", () => {
    expect(modelo({ inversiones: [nueva("500000", 12)] }).redExterna).toBeNull();
  });

  it("un externo no tiene Mis externos: se rechaza con un mensaje claro", () => {
    expect(error({ perfil: "externo", rol: null, externos: [deExterno("nueva", "500000", 12)] }).mensaje).toMatch(/Mis externos.*Interno/);
  });

  it("una inversión de externos ilegible, sin plazo o menor al mínimo dice cuál es", () => {
    expect(error({ externos: [deExterno("nueva", "abc", 12)] }).mensaje).toMatch(/^Inversión de tus externos 1: /);
    expect(error({ externos: [deExterno("nueva", "500000", 12), deExterno("nueva", "500000", null)] }).mensaje).toBe(
      "Inversión de tus externos 2: elige el plazo.",
    );
    expect(error({ externos: [deExterno("nueva", "20,000", 12)] }).mensaje).toMatch(/^Inversión de tus externos 1: .*\$30,000\.00/);
  });
});
