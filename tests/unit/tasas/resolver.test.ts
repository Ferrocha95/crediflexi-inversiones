import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import { Decimal } from "../../../src/domain/comun/decimal";
import type { CodigoError } from "../../../src/domain/comun/errores";
import { resolverTasa, type SolicitudTasa, type TasaResuelta } from "../../../src/domain/tasas/resolver";
import { cargarSemilla } from "../../../src/domain/tasas/semilla";
import type { Semilla } from "../../../src/domain/tasas/semilla.esquema";

type SemillaJson = typeof semillaJson;

const copia = (): SemillaJson => structuredClone(semillaJson);

function cargar(json: unknown): Semilla {
  const r = cargarSemilla(json);
  if (!r.ok) throw new Error(`${r.error.mensaje}\n${(r.error.detalles ?? []).join("\n")}`);
  return r.valor;
}

const semilla = cargar(semillaJson);

const base: SolicitudTasa = {
  entidad: "CREDIFLEXI",
  moneda: "MXN",
  esquema: "mensual",
  monto: "1500000",
  plazo: 12,
};

function resolverBien(s: Semilla, cambios: Partial<SolicitudTasa>): TasaResuelta {
  const r = resolverTasa(s, { ...base, ...cambios });
  if (!r.ok) throw new Error(`Se esperaba una tasa: [${r.error.codigo}] ${r.error.mensaje}`);
  return r.valor;
}

function errorDe(s: Semilla, cambios: Partial<SolicitudTasa>, codigo: CodigoError): string {
  const r = resolverTasa(s, { ...base, ...cambios });
  expect(r.ok).toBe(false);
  if (r.ok) return "";
  expect(r.error.codigo).toBe(codigo);
  // Mensaje en español claro: dice qué falló y qué hacer, sin restos técnicos.
  expect(r.error.mensaje.length).toBeGreaterThan(30);
  expect(r.error.mensaje).not.toMatch(/undefined|NaN|null|\[object/);
  return r.error.mensaje;
}

describe("resolverTasa: caso base", () => {
  it("$1,500,000 a 12 meses mensual usa la tasa del tramo desde $1,000,000", () => {
    const t = resolverBien(semilla, {});
    expect(t.tasa.toString()).toBe("0.19");
    expect(t.origen).toBe("tramo");
    expect(t.tramo.indice).toBe(5);
    expect(t.tramo.desde.toFixed(2)).toBe("1000000.00");
    expect(t.tramo.hasta).toBeNull();
    expect(t.tramo.estatus).toBe("SEGUN_USUARIO_PPTX");
    expect(t.monto.toFixed(2)).toBe("1500000.00");
    expect(t.semilla).toEqual({ version: "0.3", generado: "2026-10-01" });
  });

  it("el esquema final del plazo toma su propia columna", () => {
    expect(resolverBien(semilla, { esquema: "final_del_plazo" }).tasa.toString()).toBe("0.21");
  });

  it("aplica a ambas entidades", () => {
    expect(resolverBien(semilla, { entidad: "RAMI_SISE" }).tasa.toString()).toBe("0.19");
  });

  it("acepta el monto como Decimal", () => {
    expect(resolverBien(semilla, { monto: new Decimal("1500000.00") }).tasa.toString()).toBe("0.19");
  });

  it("devuelve la tasa tal cual está en la semilla (ningún valor escrito en el código)", () => {
    const c = copia();
    c.tasas_mxn.tramos[5].mensual["12"] = "0.1234";
    expect(resolverBien(cargar(c), {}).tasa.toString()).toBe("0.1234");
  });
});

describe("resolverTasa: límites de tramo", () => {
  it("$199,999.99 cae en el primer tramo", () => {
    const t = resolverBien(semilla, { monto: "199999.99" });
    expect(t.tramo.indice).toBe(0);
    expect(t.tasa.toString()).toBe("0.205");
  });

  it("$200,000.00 cae en el tramo siguiente (límite inferior inclusivo)", () => {
    const t = resolverBien(semilla, { monto: "200000.00" });
    expect(t.tramo.indice).toBe(1);
    expect(t.tasa.toString()).toBe("0.17");
  });

  it("$200,000.01 cae en el tramo desde $200,000", () => {
    const t = resolverBien(semilla, { monto: "200000.01" });
    expect(t.tramo.indice).toBe(1);
    expect(t.tasa.toString()).toBe("0.17");
  });

  it("$30,000.00 es el mínimo y cae en el primer tramo", () => {
    expect(resolverBien(semilla, { monto: "30000" }).tramo.indice).toBe(0);
  });

  it("con límite inferior NO inclusivo, $200,000.00 cae en el tramo anterior", () => {
    const c = copia();
    c.tasas_mxn.limite_inferior_inclusivo = false;
    const s = cargar(c);
    expect(resolverBien(s, { monto: "200000.00" }).tramo.indice).toBe(0);
    expect(resolverBien(s, { monto: "200000.01" }).tramo.indice).toBe(1);
  });

  it("con límite NO inclusivo, el mínimo exacto queda fuera de rango", () => {
    const c = copia();
    c.tasas_mxn.limite_inferior_inclusivo = false;
    errorDe(cargar(c), { monto: "30000" }, "MONTO_FUERA_DE_RANGO");
  });
});

describe("resolverTasa: monto", () => {
  it("rechaza un monto debajo del mínimo", () => {
    const m = errorDe(semilla, { monto: "29999.99" }, "MONTO_FUERA_DE_RANGO");
    expect(m).toContain("$29,999.99");
    expect(m).toContain("$30,000.00");
  });

  it("rechaza un monto arriba del máximo cuando el último tramo tiene 'hasta'", () => {
    const c = copia();
    (c.tasas_mxn.tramos[5] as { hasta: number | null }).hasta = 5000000;
    const s = cargar(c);
    expect(resolverBien(s, { monto: "5000000" }).tramo.indice).toBe(5);
    const m = errorDe(s, { monto: "5000000.01" }, "MONTO_FUERA_DE_RANGO");
    expect(m).toContain("$5,000,000.00");
  });

  it.each(["1000.001", "abc", "", "0", "-5", "1e400", "Infinity", "NaN", "1,000"])(
    "rechaza el monto %j como inválido",
    (monto) => {
      errorDe(semilla, { monto }, "MONTO_INVALIDO");
    },
  );

  it("rechaza un Decimal con más de 2 decimales", () => {
    errorDe(semilla, { monto: new Decimal("500000.005") }, "MONTO_INVALIDO");
  });
});

describe("resolverTasa: plazos", () => {
  it("rechaza un plazo que no existe", () => {
    const m = errorDe(semilla, { plazo: 9 }, "PLAZO_NO_DISPONIBLE");
    expect(m).toContain("6, 12, 18 y 24");
  });

  it.each([0, -6, 6.5, Number.NaN])("rechaza el plazo %s", (plazo) => {
    errorDe(semilla, { plazo }, "PLAZO_NO_DISPONIBLE");
  });

  it("rechaza 36 meses con $1,000,000 e indica desde qué monto se ofrece", () => {
    const m = errorDe(semilla, { monto: "1000000", plazo: 36 }, "PLAZO_NO_DISPONIBLE");
    expect(m).toContain("$2,000,000.00");
  });

  it("rechaza 36 meses con $1,999,999.99", () => {
    errorDe(semilla, { monto: "1999999.99", plazo: 36 }, "PLAZO_NO_DISPONIBLE");
  });

  it("acepta 36 meses con $2,000,000.00 en ambos esquemas", () => {
    const m = resolverBien(semilla, { monto: "2000000.00", plazo: 36 });
    expect(m.origen).toBe("plazo_adicional");
    expect(m.tasa.toString()).toBe("0.2");
    expect(m.tramo.indice).toBe(5);
    const f = resolverBien(semilla, { monto: "2000000.00", plazo: 36, esquema: "final_del_plazo" });
    expect(f.tasa.toString()).toBe("0.22");
  });

  it("con $2,000,000 los plazos normales salen del tramo, no del plazo adicional", () => {
    const t = resolverBien(semilla, { monto: "2000000", plazo: 6 });
    expect(t.origen).toBe("tramo");
    expect(t.tasa.toString()).toBe("0.185");
  });
});

describe("resolverTasa: estatus", () => {
  it("un tramo POR_CONFIRMAR bloquea y los demás siguen cotizando", () => {
    const c = copia();
    c.tasas_mxn.tramos[1].estatus = "POR_CONFIRMAR";
    const s = cargar(c);
    const m = errorDe(s, { monto: "250000" }, "TRAMO_POR_CONFIRMAR");
    expect(m).toContain("$200,000.00");
    expect(resolverBien(s, { monto: "150000" }).tramo.indice).toBe(0);
  });

  it("CONFIRMADA no bloquea", () => {
    const c = copia();
    c.tasas_mxn.tramos[1].estatus = "CONFIRMADA";
    expect(resolverBien(cargar(c), { monto: "250000" }).tramo.estatus).toBe("CONFIRMADA");
  });

  it("el plazo adicional hereda el estatus del tramo", () => {
    const c = copia();
    c.tasas_mxn.tramos[5].estatus = "POR_CONFIRMAR";
    errorDe(cargar(c), { monto: "2000000", plazo: 36 }, "TRAMO_POR_CONFIRMAR");
  });

  it("una tabla MXN POR_CONFIRMAR bloquea todo", () => {
    const c = copia();
    (c.tasas_mxn as { estatus?: string }).estatus = "POR_CONFIRMAR";
    errorDe(cargar(c), {}, "TABLA_POR_CONFIRMAR");
  });
});

describe("resolverTasa: tabla USD", () => {
  it("la tabla USD de la semilla está POR_CONFIRMAR y bloquea", () => {
    const m = errorDe(semilla, { moneda: "USD", monto: "10000", plazo: 12 }, "TABLA_POR_CONFIRMAR");
    expect(m).toContain("USD");
  });

  it("bloquea USD aunque el monto sea inválido (primero el estatus)", () => {
    errorDe(semilla, { moneda: "USD", monto: "abc" }, "TABLA_POR_CONFIRMAR");
  });

  it("al desbloquearla en una copia cotiza con la tasa de la semilla", () => {
    const c = copia();
    c.tasas_usd.estatus = "CONFIRMADA";
    (c.tasas_usd as { limite_inferior_inclusivo?: boolean }).limite_inferior_inclusivo = true;
    const s = cargar(c);
    const t = resolverBien(s, { moneda: "USD", monto: "4000", plazo: 6 });
    expect(t.tasa.toString()).toBe("0.08");
    expect(t.tramo.estatus).toBe("CONFIRMADA");
    const f = resolverBien(s, { moneda: "USD", monto: "200001", plazo: 24, esquema: "final_del_plazo" });
    expect(f.tasa.toString()).toBe("0.14");
    expect(f.tramo.indice).toBe(5);
    errorDe(s, { moneda: "USD", monto: "3999.99", plazo: 6 }, "MONTO_FUERA_DE_RANGO");
  });

  it("sin tabla USD en la semilla da MONEDA_SIN_TABLA", () => {
    const c = copia();
    delete (c as { tasas_usd?: unknown }).tasas_usd;
    errorDe(cargar(c), { moneda: "USD" }, "MONEDA_SIN_TABLA");
  });
});

describe("resolverTasa: entidad", () => {
  it("una entidad desconocida da ENTIDAD_SIN_TABLA", () => {
    errorDe(semilla, { entidad: "OTRA" }, "ENTIDAD_SIN_TABLA");
  });

  it("una entidad existente fuera de aplica_a_entidades da ENTIDAD_SIN_TABLA", () => {
    const c = copia();
    c.tasas_mxn.aplica_a_entidades = ["CREDIFLEXI"];
    const m = errorDe(cargar(c), { entidad: "RAMI_SISE" }, "ENTIDAD_SIN_TABLA");
    expect(m).toContain("RAMI_SISE");
  });
});
