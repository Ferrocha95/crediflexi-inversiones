import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import { cotizar } from "../../../src/domain/interes/cotizar";
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

describe("aviso de coherencia con el tramo siguiente", () => {
  it("avisa cuando la tasa del monto supera la del tramo inmediato siguiente", () => {
    const a = avisos();
    expect(a).toHaveLength(1);
    expect(a[0].codigo).toBe("TASA_MAYOR_QUE_TRAMO_SIGUIENTE");
    expect(a[0].severidad).toBe("aviso");
    expect(a[0].mensaje).toBe(
      "La tasa de este monto (20.00%) es mayor que la del tramo desde $200,000.00 (16.50%). " +
        "Así lo define la tabla vigente; revísalo antes de confirmar.",
    );
  });

  it("compara mismo esquema y mismo plazo", () => {
    const a = avisos({ esquema: "final_del_plazo", plazo: 24 });
    expect(a).toHaveLength(1);
    expect(a[0].mensaje).toContain("(23.50%)");
    expect(a[0].mensaje).toContain("(20.00%)");
  });

  it("trae los datos de la comparación", () => {
    expect(avisos({ plazo: 12 })[0].datos).toEqual({
      esquema: "mensual",
      plazo: "12",
      tasa: "0.205",
      tasaTramoSiguiente: "0.17",
      desdeTramoSiguiente: "200000.00",
    });
  });

  it("no avisa cuando la tasa del tramo siguiente es mayor", () => {
    expect(avisos({ monto: "250000" })).toEqual([]);
  });

  it("no avisa en el último tramo", () => {
    expect(avisos({ monto: "1500000" })).toEqual([]);
  });

  it("no avisa con tasas iguales", () => {
    const c = copia();
    c.tasas_mxn.tramos[0].mensual["6"] = c.tasas_mxn.tramos[1].mensual["6"];
    expect(avisos({}, cargar(c))).toEqual([]);
  });

  it("compara solo contra el tramo inmediato siguiente, no contra los demás", () => {
    const c = copia();
    c.tasas_mxn.tramos[0].mensual["12"] = "0.172"; // menor que el tramo 2 (0.175)...
    c.tasas_mxn.tramos[1].mensual["12"] = "0.175";
    c.tasas_mxn.tramos[2].mensual["12"] = "0.16"; // ...pero mayor que el tramo 3
    expect(avisos({ plazo: 12 }, cargar(c))).toEqual([]);
  });

  it("no avisa si el tramo siguiente no ofrece ese plazo", () => {
    const c = copia();
    const t1 = c.tasas_mxn.tramos[1];
    t1.plazos_disponibles = [6, 12, 18];
    delete (t1.mensual as Record<string, string>)["24"];
    delete (t1.final_del_plazo as Record<string, string>)["24"];
    expect(avisos({ plazo: 24 }, cargar(c))).toEqual([]);
  });

  it("no compara el plazo adicional de 36 meses", () => {
    expect(avisos({ monto: "2000000", plazo: 36 })).toEqual([]);
  });

  it("la tasa del aviso sale de la semilla, no del código", () => {
    const c = copia();
    c.tasas_mxn.tramos[0].mensual["6"] = "0.1675";
    expect(avisos({}, cargar(c))[0].mensaje).toContain("(16.75%)");
  });

  it("nunca convierte el resultado en error: la cotización sale ok con el aviso", () => {
    const r = cotizar(semilla, base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.avisos.map((a) => a.codigo)).toEqual(["TASA_MAYOR_QUE_TRAMO_SIGUIENTE"]);
    expect(r.valor.avisos).toEqual(r.avisos);
    expect(r.valor.salidas.find((s) => s.clave === "ganancia_total_plazo")?.redondeado).toBe("15000.00");
  });
});
