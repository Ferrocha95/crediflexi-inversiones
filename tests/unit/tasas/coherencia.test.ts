import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import { resolverTasa, type SolicitudTasa } from "../../../src/domain/tasas/resolver";
import { cargarSemilla } from "../../../src/domain/tasas/semilla";
import type { Semilla } from "../../../src/domain/tasas/semilla.esquema";
import type { Aviso } from "../../../src/domain/comun/resultado";

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
  monto: "150000",
  plazo: 6,
};

function avisos(cambios: Partial<SolicitudTasa> = {}, s: Semilla = semilla): readonly Aviso[] {
  const r = resolverTasa(s, { ...base, ...cambios });
  if (!r.ok) throw new Error(`Se esperaba una tasa: [${r.error.codigo}] ${r.error.mensaje}`);
  return r.avisos;
}

// Con la Tabla de Diseño ningún tramo supera al siguiente: las pruebas que
// necesitan un aviso lo fabrican en una copia de la semilla (PENDIENTES, cc).
describe("aviso de coherencia con el tramo siguiente", () => {
  it("no avisa cuando la tasa del tramo siguiente es mayor", () => {
    expect(avisos({ monto: "250000" })).toEqual([]);
  });

  it("no avisa en el último tramo", () => {
    expect(avisos({ monto: "1500000" })).toEqual([]);
  });

  it("compara solo contra el tramo inmediato siguiente, no contra los demás", () => {
    const c = copia();
    c.tasas_mxn.tramos[0].mensual["12"] = "0.172"; // menor que el tramo 2 (0.175)...
    c.tasas_mxn.tramos[1].mensual["12"] = "0.175";
    c.tasas_mxn.tramos[2].mensual["12"] = "0.16"; // ...pero mayor que el tramo 3
    expect(avisos({ plazo: 12 }, cargar(c))).toEqual([]);
  });

  it("la tasa del aviso sale de la semilla, no del código", () => {
    const c = copia();
    c.tasas_mxn.tramos[0].mensual["6"] = "0.1675";
    expect(avisos({}, cargar(c))[0].mensaje).toContain("(16.75%)");
  });
});
