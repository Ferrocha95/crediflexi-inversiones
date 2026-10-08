import { describe, expect, it } from "vitest";
import textosJson from "../../../seed/textos_cotizacion.json";
import { modeloReclutamiento, type CamposReclutamiento } from "../../../src/aplicacion/reclutamiento";
import { cargarTextos, type TextosReclutamiento } from "../../../src/aplicacion/textos";
import { semillaComisiones as s } from "../comisiones/ayudas";

// Modo reclutamiento (Sprint 5): un solo dato, la captación del mes, puesta
// entera como UNA inversión nueva en cada plazo, más el bono de externos.
// Valores de referencia INDEPENDIENTES (punto C, dados por Fernando):
//   500,000:   6,150.00; 13,530.00;  20,910.00;  28,290.00
//   1,000,000: 12,900.00; 28,380.00; 43,860.00;  59,340.00
//   3,000,000: 40,500.00; 89,100.00; 137,700.00; 186,300.00
//   En los tres, 24 meses ÷ 6 meses = 4.60.

const t = (() => {
  const r = cargarTextos(textosJson, "seed/textos_cotizacion.json");
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor.reclutamiento;
})();

const OCTUBRE = new Date("2026-10-08T12:00:00-06:00");
const BASE: CamposReclutamiento = { presenta: "Persona Sintética Uno", monto: "1000000" };

function modelo(c: Partial<CamposReclutamiento> = {}, textos: TextosReclutamiento = t, ahora = OCTUBRE) {
  const r = modeloReclutamiento(s, textos, { ...BASE, ...c }, ahora);
  if (!r.ok) throw new Error(r.error.mensaje);
  return r.valor;
}

function error(c: Partial<CamposReclutamiento>) {
  const r = modeloReclutamiento(s, t, { ...BASE, ...c }, OCTUBRE);
  if (r.ok) throw new Error("Se esperaba un error");
  return r.error;
}

describe("modeloReclutamiento: comparativo por plazos (valores de referencia)", () => {
  it.each([
    ["500000", ["$6,150.00", "$13,530.00", "$20,910.00", "$28,290.00"]],
    ["1000000", ["$12,900.00", "$28,380.00", "$43,860.00", "$59,340.00"]],
    ["3000000", ["$40,500.00", "$89,100.00", "$137,700.00", "$186,300.00"]],
  ] as const)("captación %s: comisión a 6, 12, 18 y 24 meses", (monto, esperadas) => {
    const m = modelo({ monto });
    expect(m.comparativo.map((c) => [c.plazo, c.comision])).toEqual([
      [6, esperadas[0]],
      [12, esperadas[1]],
      [18, esperadas[2]],
      [24, esperadas[3]],
    ]);
  });

  it.each(["500000", "1000000", "3000000"])("captación %s: a 24 meses se ganaría 4.60 veces lo de 6 meses", (monto) => {
    expect(modelo({ monto }).fraseVeces).toBe("A 24 meses se ganaría 4.60 veces lo de 6 meses.");
  });

  it("una sola línea por plazo, con el capital sin centavos", () => {
    expect(modelo().comparativo.map((c) => [c.etiqueta, c.linea])).toEqual([
      ["6 meses", "$1,000,000 × 1.29% = $12,900.00"],
      ["12 meses", "$1,000,000 × 2.838% = $28,380.00"],
      ["18 meses", "$1,000,000 × 4.386% = $43,860.00"],
      ["24 meses", "$1,000,000 × 5.934% = $59,340.00"],
    ]);
  });

  it("las barras: 24 meses ocupa todo el ancho y las demás, en proporción", () => {
    const c = modelo().comparativo;
    expect(c[3].fraccion).toBe(1);
    expect(c[0].fraccion).toBeCloseTo(12900 / 59340, 10);
  });

  it("un capital con centavos los conserva en la línea", () => {
    expect(modelo({ monto: "1000000.50" }).comparativo[0].linea).toBe("$1,000,000.50 × 1.29% = $12,900.01");
  });
});

describe("modeloReclutamiento: la cifra grande", () => {
  it("por omisión a 12 meses: comisión más bono, con el plazo en el detalle", () => {
    const m = modelo();
    expect(m.cifra).toEqual({
      total: "$43,380.00",
      detalle: "$1,000,000 a 12 meses: comisión $28,380.00 más bono $15,000.00",
      plazo: 12,
    });
    expect(m.comparativo.filter((c) => c.elegido).map((c) => c.plazo)).toEqual([12]);
  });

  it("al elegir 24 meses: 59,340.00 + 15,000.00 = 74,340.00", () => {
    const m = modelo({ plazo: 24 });
    expect(m.cifra.total).toBe("$74,340.00");
    expect(m.cifra.detalle).toBe("$1,000,000 a 24 meses: comisión $59,340.00 más bono $15,000.00");
    expect(m.comparativo.filter((c) => c.elegido).map((c) => c.plazo)).toEqual([24]);
  });

  it("3,000,000 a 12 meses: 89,100.00 + 25,000.00 = 114,100.00", () => {
    expect(modelo({ monto: "3000000" }).cifra.total).toBe("$114,100.00");
  });

  it("menos de 1,000,000 no lleva bono: 500,000 a 12 meses = 13,530.00", () => {
    const m = modelo({ monto: "500000" });
    expect(m.cifra.total).toBe("$13,530.00");
    expect(m.cifra.detalle).toBe("$500,000 a 12 meses: comisión $13,530.00 más bono $0.00");
  });

  it("acepta comas y signo de pesos en la captación", () => {
    expect(modelo({ monto: "$1,000,000" }).cifra.total).toBe("$43,380.00");
  });

  it("con la mezcla de plazos: 500,000 a 6 (6,150.00) + 500,000 a 24 (28,290.00) + bono 15,000.00 = 49,440.00", () => {
    const m = modelo({ mezcla: { "6": "500,000", "12": "", "18": "", "24": "500000" } });
    expect(m.cifra).toEqual({
      total: "$49,440.00",
      detalle: "$1,000,000 repartidos entre plazos: comisión $34,440.00 más bono $15,000.00",
      plazo: null,
    });
    expect(m.mezcla?.map((l) => [l.plazo, l.monto, l.comision, l.operacion])).toEqual([
      ["6 meses", "$500,000", "$6,150.00", "$500,000 × 1.23% = $6,150.00"],
      ["24 meses", "$500,000", "$28,290.00", "$500,000 × 5.658% = $28,290.00"],
    ]);
    expect(m.comparativo.some((c) => c.elegido)).toBe(false);
  });

  it("una mezcla vacía no cuenta: se usa el plazo elegido", () => {
    const m = modelo({ mezcla: { "6": "", "12": " ", "18": "", "24": "" } });
    expect(m.cifra.plazo).toBe(12);
    expect(m.mezcla).toBeNull();
  });

  it("si la mezcla no suma la captación, lo dice con las dos cifras", () => {
    expect(error({ mezcla: { "6": "400000", "24": "500000" } }).mensaje).toBe(
      "La mezcla de plazos suma $900,000.00 y la captación del mes es $1,000,000.00. Ajusta los montos para que sumen lo mismo.",
    );
  });

  it("sin captación pide escribirla", () => {
    expect(error({ monto: "" }).mensaje).toBe("Escribe cuánto captarías al mes, por ejemplo 1,000,000.");
    expect(error({ monto: "0" }).mensaje).toBe("Escribe cuánto captarías al mes, por ejemplo 1,000,000.");
  });

  it("una captación menor al mínimo dice el mínimo", () => {
    expect(error({ monto: "20000" }).mensaje).toMatch(/\$30,000\.00/);
  });

  it("un plazo que no está en la tabla se rechaza", () => {
    expect(error({ plazo: 9 }).mensaje).toMatch(/6, 12, 18 y 24/);
  });
});

describe("modeloReclutamiento: la escalera de bonos", () => {
  const TEXTOS = [
    "Menos de $1,000,000: sin bono",
    "De $1,000,000 a $1,499,999: $15,000 más la comisión",
    "De $1,500,000 a $1,999,999: $20,000 más la comisión",
    "$2,000,000 en adelante: $25,000 más la comisión",
  ];

  it.each([
    ["999999", 0],
    ["1000000", 1],
    ["1499999", 1],
    ["1500000", 2],
    ["1999999", 2],
    ["2000000", 3],
    ["3000000", 3],
  ] as const)("captación %s: resalta el escalón %i", (monto, actual) => {
    const e = modelo({ monto }).escalera;
    expect(e.map((x) => x.texto)).toEqual(TEXTOS);
    expect(e.map((x) => x.actual)).toEqual(TEXTOS.map((_, i) => i === actual));
  });

  it("los escalones salen de la semilla, no del código", () => {
    expect(s.incentivosExternos).toHaveLength(3);
    expect(modelo().escalera).toHaveLength(s.incentivosExternos.length + 1);
  });
});

describe("modeloReclutamiento: inversiones por plazo", () => {
  it("3 inversiones a 12 meses: 333,333.34 y 2 de 333,333.33, a 9,020.00 cada una: 27,060.00", () => {
    const c = modelo({ inversionesPorPlazo: 3 }).comparativo[1];
    expect(c.comision).toBe("$27,060.00");
    expect(c.linea).toBe("1 × ($333,333.34 × 2.706% = $9,020.00) + 2 × ($333,333.33 × 2.706% = $9,020.00) = $27,060.00");
  });

  it("el aviso de inversiones por plazo va siempre, con el número", () => {
    expect(modelo().avisoInversiones).toBe(
      "Cálculo con 1 inversión(es) por plazo: si el mismo monto se reparte en más inversiones, la tasa de cada una puede ser menor.",
    );
  });

  it.each([0, 21, 2.5, -1])("inversiones por plazo %s: se rechaza (entero de 1 a 20)", (n) => {
    expect(error({ inversionesPorPlazo: n }).mensaje).toMatch(/entero de 1 a 20/);
  });
});

describe("modeloReclutamiento: avisos y frases", () => {
  it("el aviso aprobado por RH, el de las tasas y el de incorporación, exactos", () => {
    const m = modelo();
    expect(m.aviso).toBe(
      "Ejemplo calculado con las tablas vigentes al 7 de octubre de 2026. Los ingresos dependen de lo que cada persona logre captar; no es una oferta de empleo ni una garantía de ingresos.",
    );
    expect(m.avisoTasas).toBe("Las tasas están sujetas a cambio.");
    expect(m.avisoIncorporacion).toBe(
      "Al superar $1,000,000 en ingresos, se podrá evaluar la incorporación a la compañía, en caso de que exista interés por parte del colaborador externo.",
    );
  });

  it("las ocho frases, con el monto mínimo de la semilla", () => {
    const f = modelo().frases;
    expect(f).toHaveLength(8);
    expect(f[0]).toBe("Tu captación, tu ganancia.");
    expect(f[5]).toBe("Empieza con tu primera inversión de $30,000.");
  });

  it("mientras RH no las apruebe, la pantalla lleva el aviso interno", () => {
    expect(modelo().avisoFrasesRh).toBe("Frases pendientes de aprobación de RH");
    expect(modelo({}, { ...t, frasesAprobadasPorRh: true }).avisoFrasesRh).toBeNull();
  });

  it("nunca muestra sueldo base", () => {
    expect(JSON.stringify(modelo()).toLowerCase()).not.toContain("sueldo base");
  });
});

describe("modeloReclutamiento: quien presenta y fechas", () => {
  it("quien presenta: limpio y en la línea del PDF; vacío no lleva línea", () => {
    expect(modelo({ presenta: "  Persona   Sintética  " }).presenta).toBe("Presenta: Persona Sintética");
    expect(modelo({ presenta: "" }).presenta).toBeNull();
  });

  it("se corta a 60 caracteres", () => {
    expect(modelo({ presenta: "P".repeat(80) }).presenta).toBe(`Presenta: ${"P".repeat(60)}`);
  });

  it.each([
    "Ingreso fijo asegurado",
    "Ganancia garantizada",
    "Ganarás mucho",
    "Sin riesgo",
    "Ingreso ilimitado",
    "Ganancias sin límite",
    "Dinero fácil",
    "Sin esfuerzo",
    "Libertad financiera",
    "Hazte millonario",
  ])("rechaza lenguaje de promesa en quien presenta: %s", (presenta) => {
    expect(error({ presenta }).mensaje).toMatch(/quien presenta/);
  });

  it("las fechas de pago por quincena del mes en curso (Ciudad de México)", () => {
    expect(modelo().fechas).toEqual([
      "Lo captado del 1 al 15 de octubre se pagaría el 16/10/2026.",
      "Lo captado del 16 al fin de octubre se pagaría el 01/11/2026.",
    ]);
  });

  it("la fecha del documento es la de hoy en la Ciudad de México", () => {
    expect(modelo({}, t, new Date("2026-10-09T05:00:00Z")).fecha).toBe("08/10/2026");
  });
});
