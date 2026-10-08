import { describe, expect, it } from "vitest";
import { modeloComisiones, opcionesComisiones, plazosDeComision, porcentajeComision, type CamposComisiones } from "../../../src/aplicacion/comisiones";
import { Decimal } from "../../../src/domain/comun/decimal";
import { semillaComisiones as s } from "../comisiones/ayudas";

// El modelo de la pantalla /comisiones: solo texto. Las cifras de referencia
// son las mismas del motor (tabla N1), calculadas fuera de él.

type Inversion = CamposComisiones["inversiones"][number];
const nueva = (monto: string, plazo: number | null, fecha = "2026-10-07"): Inversion => ({ tipo: "nueva", monto, plazo, fecha });

const INTERNO: CamposComisiones = { perfil: "interno", rol: "EJECUTIVO", inversiones: [], captacionRedExterna: "" };

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
      aporteRed: null,
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
    expect(m.sueldoBase).toBe("$15,000.00");
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

  it("red externa: muestra el aporte del 30%", () => {
    const m = modelo({ inversiones: [nueva("650000", 12)], captacionRedExterna: "500,000" });
    expect(m.totales.aporteRed).toBe("$150,000.00");
    expect(m.totales.captacionParaMeta).toBe("$800,000.00");
  });

  it("GERENTE: sin bono ni sueldo base", () => {
    const m = modelo({ rol: "GERENTE", inversiones: [nueva("500000", 12)] });
    expect(m.bono).toBeNull();
    expect(m.sueldoBase).toBeNull();
    expect(m.avance!.meta).toBe("$2,000,000.00");
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
    expect(m.pagos).toEqual([{ fecha: "01/11/2026", monto: "$13,530.00", inversiones: [1] }]);
    expect(m.sueldoBase).toBe("$0.00");
  });

  it("la red externa se ignora en externos (el campo solo existe para internos)", () => {
    const m = modelo({ perfil: "externo", rol: null, inversiones: [nueva("500000", 12)], captacionRedExterna: "100000" });
    expect(m.totales.aporteRed).toBeNull();
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

  it("captación de red ilegible", () => {
    expect(error({ captacionRedExterna: "mucho" }).mensaje).toMatch(/red externa/i);
  });
});

describe("plazosDeComision", () => {
  it("salen de la tabla del nivel vigente", () => {
    expect(plazosDeComision(s)).toEqual([6, 12, 18, 24]);
  });
});

describe("opcionesComisiones", () => {
  it("los plazos y el porcentaje de la red salen de la semilla", () => {
    expect(opcionesComisiones(s)).toEqual({ plazos: [6, 12, 18, 24], porcentajeRed: "30%" });
  });
});
