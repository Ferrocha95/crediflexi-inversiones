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

  it("RH aprobó las frases (Sprint 6b): sin aviso interno; si se desaprueban, vuelve el aviso", () => {
    expect(modelo().avisoFrasesRh).toBeNull();
    expect(modelo({}, { ...t, frasesAprobadasPorRh: false }).avisoFrasesRh).toBe("Frases pendientes de aprobación de RH");
  });

  it("externo (por omisión): nunca muestra sueldo base", () => {
    expect(modelo().perfil).toBe("externo");
    // Lo que se muestra del externo; el bloque de textos trae también los rótulos del interno.
    expect(JSON.stringify({ ...modelo({ perfil: "externo" }), textos: null }).toLowerCase()).not.toContain("sueldo base");
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

// Reclutamiento para internos (Sprint 7a). Valores de referencia de Fernando,
// calculados fuera del motor, con una sola inversión nueva por plazo:
//   1,000,000 a 12 meses: comisión 28,380.00, bono 0, sueldo base 15,000, total 43,380.00.
//   1,000,000 a 24 meses: comisión 59,340.00, total 74,340.00.
//   1,500,000 a 12 meses: comisión 43,560.00 (2.904%), bono 5,000, total 63,560.00.
//   Desbloqueo: 800,000 desbloquea; 799,999.99 no.
describe("modeloReclutamiento: perfil interno", () => {
  const interno = (c: Partial<CamposReclutamiento> = {}, textos: TextosReclutamiento = t) => modelo({ perfil: "interno", ...c }, textos);
  const datos = (c: Partial<CamposReclutamiento> = {}) => {
    const m = interno(c);
    if (m.interno === null) throw new Error("Se esperaba el bloque interno");
    return { m, i: m.interno };
  };

  it.each([
    [{}, "$28,380.00", "$0.00", "$43,380.00"],
    [{ plazo: 24 }, "$59,340.00", "$0.00", "$74,340.00"],
    [{ monto: "1,500,000" }, "$43,560.00", "$5,000.00", "$63,560.00"],
  ] as const)("%o: comisión %s, bono %s, sueldo base 15,000, total %s", (c, comision, bono, total) => {
    const { m, i } = datos(c);
    expect([i.sueldoBase, i.comision, i.bono, m.cifra.total]).toEqual(["$15,000.00", comision, bono, total]);
    expect(i.operacion).toBe(`$15,000.00 + ${comision} + ${bono} = ${total}`);
  });

  it("1,500,000 a 12 meses: la línea usa la tasa completa 2.904%", () => {
    expect(datos({ monto: "1500000" }).m.comparativo.find((p) => p.plazo === 12)?.linea).toBe("$1,500,000 × 2.904% = $43,560.00");
  });

  it("la cifra grande se titula Total estimado del mes (simulación), con el sueldo base rotulado propuesta", () => {
    const { m } = datos();
    expect(m.tituloCifra).toBe("Total estimado del mes (simulación)");
    expect(m.cifra.detalle).toBe("$1,000,000 a 12 meses: sueldo base $15,000.00 (propuesta) más comisión $28,380.00 más bono $0.00");
    expect(m.interno?.rotuloSueldoBase).toBe("Sueldo base (propuesta)");
  });

  it("desbloqueo al 80% de la meta ($800,000): 800,000 desbloquea; 799,999.99 no", () => {
    const si = datos({ monto: "800,000" }).i;
    expect(si.desbloqueada).toBe(true);
    expect(si.estadoDesbloqueo).toBe("Con esta captación las comisiones quedan desbloqueadas.");
    const no = datos({ monto: "799,999.99" });
    expect(no.i.desbloqueada).toBe(false);
    expect(no.i.estadoDesbloqueo).toBe("Con esta captación las comisiones quedan bloqueadas: faltan $0.01 para llegar a $800,000.");
    expect([no.i.comision, no.i.bono, no.m.cifra.total]).toEqual(["$0.00", "$0.00", "$15,000.00"]);
    expect(no.m.comparativo.every((p) => p.bloqueada)).toBe(true);
    expect(datos().i.notaDesbloqueo).toBe("Las comisiones se desbloquean desde el 80% de la meta ($800,000).");
  });

  it("la tabla de bonos con rangos y la fila alcanzada", () => {
    expect(datos({ monto: "1,500,000" }).i.bonos).toEqual([
      { cumplimiento: "100% de la meta", desde: "$1,000,000", hasta: "$1,499,999", bono: "$0", actual: false },
      { cumplimiento: "150% de la meta", desde: "$1,500,000", hasta: "$1,999,999", bono: "$5,000", actual: true },
      { cumplimiento: "200% de la meta", desde: "$2,000,000", hasta: "En adelante", bono: "$10,000", actual: false },
    ]);
    expect(datos({ monto: "900,000" }).i.bonos.some((b) => b.actual)).toBe(false);
  });

  it("el comparativo por plazos es el mismo cálculo de comisión", () => {
    expect(datos().m.comparativo.map((p) => [p.plazo, p.comision, p.bloqueada])).toEqual([
      [6, "$12,900.00", false],
      [12, "$28,380.00", false],
      [18, "$43,860.00", false],
      [24, "$59,340.00", false],
    ]);
  });

  it("con la mezcla de plazos: 500,000 a 6 + 500,000 a 24 = comisión 34,440.00, total 49,440.00", () => {
    const { m, i } = datos({ mezcla: { "6": "500000", "24": "500000" } });
    expect([i.comision, m.cifra.total, m.cifra.plazo]).toEqual(["$34,440.00", "$49,440.00", null]);
    expect(m.cifra.detalle).toBe("$1,000,000 repartidos entre plazos: sueldo base $15,000.00 (propuesta) más comisión $34,440.00 más bono $0.00");
  });

  it("sin escalera de externos, sin aviso de incorporación, sin frases de externos ni fechas de pago de externos", () => {
    const { m } = datos();
    expect(m.escalera).toEqual([]);
    expect(m.avisoIncorporacion).toBeNull();
    expect(m.frases).toEqual([]);
    expect(m.fechas).toBeNull();
  });

  it("los avisos aprobados van igual que en externo", () => {
    const { m } = datos();
    expect(m.aviso).toBe(modelo().aviso);
    expect(m.avisoTasas).toBe("Las tasas están sujetas a cambio.");
    expect(m.avisoInversiones).toBe(modelo().avisoInversiones);
  });

  it("mientras RH no apruebe los textos para internos, la pantalla lleva el aviso; aprobados, no; el externo nunca", () => {
    expect(interno().avisoTextoInternoRh).toBe("Texto para internos pendiente de aprobación de RH");
    expect(interno({}, { ...t, frasesInternasAprobadasPorRh: true }).avisoTextoInternoRh).toBeNull();
    expect(modelo().avisoTextoInternoRh).toBeNull();
  });

  it("externo: el resultado se titula como hoy y sin bloque interno", () => {
    const m = modelo();
    expect(m.tituloCifra).toBe("Lo que se ganaría en un mes");
    expect(m.interno).toBeNull();
    expect(m.comparativo.every((p) => !p.bloqueada)).toBe(true);
  });
});
