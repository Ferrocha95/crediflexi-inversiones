import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import { cargarSemilla } from "../../../src/domain/tasas/semilla";
import type { Semilla } from "../../../src/domain/tasas/semilla.esquema";

type SemillaJson = typeof semillaJson;

const copia = (): SemillaJson => structuredClone(semillaJson);

/** Para escribir valores de tipo incorrecto a propósito en una copia. */
const comoRegistro = (valor: unknown) => valor as Record<string, unknown>;

function cargarBien(json: unknown): Semilla {
  const r = cargarSemilla(json);
  if (!r.ok) {
    throw new Error(`Se esperaba una semilla válida: ${r.error.mensaje}\n${(r.error.detalles ?? []).join("\n")}`);
  }
  return r.valor;
}

function detallesDelFallo(json: unknown): string[] {
  const r = cargarSemilla(json);
  expect(r.ok).toBe(false);
  if (r.ok) return [];
  expect(r.error.codigo).toBe("SEMILLA_INVALIDA");
  expect(r.error.mensaje).toContain("semilla");
  return [...(r.error.detalles ?? [])];
}

describe("cargarSemilla: semilla real 0.5", () => {
  const semilla = cargarBien(semillaJson);

  it("conserva versión y fecha de la semilla", () => {
    expect(semilla.version).toBe("0.5");
    expect(semilla.generado).toBe("2026-10-02");
  });

  it("carga las entidades", () => {
    expect(semilla.entidades).toEqual(["CREDIFLEXI", "RAMI_SISE"]);
  });

  it("carga la tabla MXN con 6 tramos, límite inclusivo y sin estatus de tabla", () => {
    const mxn = semilla.tablas.MXN;
    expect(mxn).toBeDefined();
    expect(mxn!.tramos).toHaveLength(6);
    expect(mxn!.limiteInferiorInclusivo).toBe(true);
    expect(mxn!.estatus).toBeNull();
    expect(mxn!.aplicaAEntidades).toEqual(["CREDIFLEXI", "RAMI_SISE"]);
  });

  it("convierte montos y tasas a Decimal sin pérdida", () => {
    const t0 = semilla.tablas.MXN!.tramos[0];
    expect(t0.desde.toFixed(2)).toBe("30000.00");
    expect(t0.hasta!.toFixed(2)).toBe("200000.00");
    expect(t0.estatus).toBe("CONFIRMADA");
    expect(t0.tasas.mensual.get(12)!.toString()).toBe("0.165");
    expect(t0.tasas.final_del_plazo.get(24)!.toString()).toBe("0.195");
    expect(t0.plazosDisponibles).toEqual([6, 12, 18, 24]);
    expect(semilla.tablas.MXN!.tramos[1].desde.toFixed(2)).toBe("200000.01");
    expect(semilla.tablas.MXN!.tramos[5].desde.toFixed(2)).toBe("1000000.01");
    expect(semilla.tablas.MXN!.tramos[5].hasta).toBeNull();
  });

  it("normaliza la tabla USD: POR_CONFIRMAR, sin límite definido, 6 tramos", () => {
    const usd = semilla.tablas.USD;
    expect(usd).toBeDefined();
    expect(usd!.estatus).toBe("POR_CONFIRMAR");
    expect(usd!.limiteInferiorInclusivo).toBeNull();
    expect(usd!.tramos).toHaveLength(6);
    expect(usd!.tramos[1].desde.toFixed(2)).toBe("40001.00");
    expect(usd!.tramos[0].tasas.mensual.get(6)!.toString()).toBe("0.08");
    expect(usd!.tramos[0].tasas.final_del_plazo.get(6)!.toString()).toBe("0.1");
    expect(usd!.tramos[0].plazosDisponibles).toEqual([6, 12, 18, 24]);
    expect(usd!.plazoAdicional).toBeNull();
  });

  it("carga las etiquetas de cotización de ambos esquemas", () => {
    expect(semilla.reglas.etiquetas.mensual.rendimiento_mensual_pesos).toBe("Pago mensual");
    expect(semilla.reglas.etiquetas.final.ganancia_total_plazo).toBe("Ganancia total al final del plazo");
    expect(semilla.reglas.salidas).toEqual([
      "rendimiento_mensual_pesos",
      "rendimiento_anual_pesos",
      "ganancia_total_plazo",
    ]);
  });

  it("no modifica el objeto de entrada", () => {
    const original = copia();
    const antes = JSON.stringify(original);
    cargarSemilla(original);
    expect(JSON.stringify(original)).toBe(antes);
  });
});

describe("cargarSemilla: estatus", () => {
  it("acepta CONFIRMADA", () => {
    const c = copia();
    c.tasas_mxn.tramos[0].estatus = "CONFIRMADA";
    expect(cargarBien(c).tablas.MXN!.tramos[0].estatus).toBe("CONFIRMADA");
  });

  it("rechaza un estatus desconocido", () => {
    const c = copia();
    c.tasas_mxn.tramos[0].estatus = "CASI_CONFIRMADA";
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_mxn.tramos.0.estatus");
  });
});

describe("cargarSemilla: tasas y montos", () => {
  it("rechaza una tasa escrita como número", () => {
    const c = copia();
    comoRegistro(c.tasas_mxn.tramos[0].mensual)["6"] = 0.2;
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_mxn.tramos.0.mensual.6");
  });

  it("rechaza una tasa que no es fracción decimal", () => {
    const c = copia();
    c.tasas_mxn.tramos[0].mensual["6"] = "20%";
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_mxn.tramos.0.mensual.6");
  });

  it("rechaza una tasa mayor que 1", () => {
    const c = copia();
    c.tasas_mxn.tramos[0].mensual["6"] = "1.5";
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_mxn.tramos.0.mensual.6");
  });

  it("rechaza un monto de tramo con más de 2 decimales", () => {
    const c = copia();
    c.tasas_mxn.tramos[0].hasta = 199999.999;
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_mxn.tramos.0.hasta");
  });

  it("rechaza un monto de tramo negativo", () => {
    const c = copia();
    c.tasas_mxn.tramos[0].desde = -1;
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_mxn.tramos.0.desde");
  });
});

describe("cargarSemilla: estructura de tramos", () => {
  it("rechaza tramos desordenados", () => {
    const c = copia();
    const [a, b] = c.tasas_mxn.tramos;
    c.tasas_mxn.tramos[0] = b;
    c.tasas_mxn.tramos[1] = a;
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_mxn.tramos");
  });

  it("rechaza tramos traslapados", () => {
    const c = copia();
    c.tasas_mxn.tramos[0].hasta = 250000;
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_mxn.tramos");
  });

  it("rechaza un tramo intermedio sin 'hasta'", () => {
    const c = copia();
    comoRegistro(c.tasas_mxn.tramos[0]).hasta = null;
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_mxn.tramos");
  });

  it("rechaza un plazo disponible sin tasa en algún esquema", () => {
    const c = copia();
    delete comoRegistro(c.tasas_mxn.tramos[0].final_del_plazo)["24"];
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_mxn.tramos.0");
  });

  it("rechaza una entidad desconocida en aplica_a_entidades", () => {
    const c = copia();
    c.tasas_mxn.aplica_a_entidades = ["CREDIFLEXI", "OTRA"];
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_mxn.aplica_a_entidades");
  });
});

describe("cargarSemilla: tabla USD", () => {
  it("rechaza desbloquear USD sin definir limite_inferior_inclusivo", () => {
    const c = copia();
    c.tasas_usd.estatus = "SEGUN_USUARIO_PPTX";
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_usd.limite_inferior_inclusivo");
  });

  it("acepta USD desbloqueada con limite_inferior_inclusivo", () => {
    const c = copia();
    c.tasas_usd.estatus = "CONFIRMADA";
    comoRegistro(c.tasas_usd).limite_inferior_inclusivo = true;
    const usd = cargarBien(c).tablas.USD!;
    expect(usd.estatus).toBe("CONFIRMADA");
    expect(usd.limiteInferiorInclusivo).toBe(true);
  });

  it("rechaza filas mensual y final del plazo con límites distintos", () => {
    const c = copia();
    c.tasas_usd.final_del_plazo[1].desde = 40002;
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_usd");
  });

  it("rechaza filas mensual y final del plazo de distinta longitud", () => {
    const c = copia();
    c.tasas_usd.final_del_plazo.pop();
    expect(detallesDelFallo(c).join("\n")).toContain("tasas_usd");
  });
});

describe("cargarSemilla: reglas de cálculo", () => {
  it("rechaza una fórmula modificada", () => {
    const c = copia();
    c.reglas_de_calculo.ganancia_total_plazo = "capital * tasa_anual * meses / 360";
    expect(detallesDelFallo(c).join("\n")).toContain("reglas_de_calculo.ganancia_total_plazo");
  });

  it("rechaza un tipo de interés distinto de simple", () => {
    const c = copia();
    c.reglas_de_calculo.interes = "compuesto";
    expect(detallesDelFallo(c).join("\n")).toContain("reglas_de_calculo.interes");
  });

  it("acepta notas y etiquetas modificadas", () => {
    const c = copia();
    c.reglas_de_calculo.nota_etiquetas = "Otra nota";
    c.reglas_de_calculo.etiquetas_cotizacion.mensual.rendimiento_mensual_pesos = "Pago cada mes";
    c.reglas_de_calculo.redondeo_pptx = "otro texto";
    expect(cargarBien(c).reglas.etiquetas.mensual.rendimiento_mensual_pesos).toBe("Pago cada mes");
  });

  it("rechaza una etiqueta vacía", () => {
    const c = copia();
    c.reglas_de_calculo.etiquetas_cotizacion.final.ganancia_total_plazo = "";
    expect(detallesDelFallo(c).join("\n")).toContain(
      "reglas_de_calculo.etiquetas_cotizacion.final.ganancia_total_plazo",
    );
  });
});

describe("cargarSemilla: entradas que no son semilla", () => {
  it("rechaza null con mensaje en español", () => {
    const detalles = detallesDelFallo(null);
    expect(detalles.length).toBeGreaterThan(0);
    expect(detalles.join("\n")).not.toMatch(/Invalid input/);
  });

  it("los detalles de error vienen en español", () => {
    const c = copia();
    delete comoRegistro(c).version;
    const texto = detallesDelFallo(c).join("\n");
    expect(texto).toContain("version");
    expect(texto).not.toMatch(/Invalid input|expected/);
  });
});
