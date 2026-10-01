import { describe, expect, it } from "vitest";
import { plazosDisponibles, type ConsultaPlazos } from "../../../src/aplicacion/plazos";
import { cargar, copiaSemilla, semillaReal } from "../oro/ayudas";

const consulta = (cambios: Partial<ConsultaPlazos> = {}): ConsultaPlazos => ({
  entidad: "CREDIFLEXI",
  moneda: "MXN",
  esquema: "mensual",
  monto: "1500000",
  ...cambios,
});

function plazos(cambios: Partial<ConsultaPlazos> = {}): readonly number[] {
  const r = plazosDisponibles(semillaReal, consulta(cambios));
  if (!r.ok) throw new Error(`[${r.error.codigo}] ${r.error.mensaje}`);
  return r.valor;
}

function codigo(cambios: Partial<ConsultaPlazos>): string {
  const r = plazosDisponibles(semillaReal, consulta(cambios));
  if (r.ok) throw new Error("Se esperaba un error");
  return r.error.codigo;
}

describe.each(["CREDIFLEXI", "RAMI_SISE"])("plazosDisponibles (%s)", (entidad) => {
  it.each(["mensual", "final_del_plazo"] as const)("esquema %s: $1,999,999.99 ofrece 6, 12, 18 y 24", (esquema) => {
    expect(plazos({ entidad, esquema, monto: "1999999.99" })).toEqual([6, 12, 18, 24]);
  });

  it.each(["mensual", "final_del_plazo"] as const)("esquema %s: $2,000,000.00 agrega 36", (esquema) => {
    expect(plazos({ entidad, esquema, monto: "2000000.00" })).toEqual([6, 12, 18, 24, 36]);
  });

  it("$30,000 (primer tramo) ofrece 6, 12, 18 y 24", () => {
    expect(plazos({ entidad, monto: "30000" })).toEqual([6, 12, 18, 24]);
  });
});

describe("plazosDisponibles: devuelve el error del dominio tal cual", () => {
  it("monto inválido", () => {
    expect(codigo({ monto: "abc" })).toBe("MONTO_INVALIDO");
  });

  it("monto debajo del mínimo", () => {
    expect(codigo({ monto: "29999.99" })).toBe("MONTO_FUERA_DE_RANGO");
  });

  it("USD está por confirmar", () => {
    expect(codigo({ moneda: "USD" })).toBe("TABLA_POR_CONFIRMAR");
  });

  it("entidad que no existe", () => {
    expect(codigo({ entidad: "ENTIDAD_SINTETICA" })).toBe("ENTIDAD_SIN_TABLA");
  });

  it("tramo POR_CONFIRMAR (semilla modificada en la prueba)", () => {
    const j = copiaSemilla();
    j.tasas_mxn.tramos[5].estatus = "POR_CONFIRMAR";
    const r = plazosDisponibles(cargar(j), consulta());
    expect(r.ok ? "OK" : r.error.codigo).toBe("TRAMO_POR_CONFIRMAR");
  });
});

describe("plazosDisponibles: sale de la semilla, no del código", () => {
  it("si la semilla quita el plazo adicional, 36 deja de ofrecerse", () => {
    const j = copiaSemilla();
    (j.tasas_mxn as { plazo_adicional: unknown }).plazo_adicional = null;
    const r = plazosDisponibles(cargar(j), consulta({ monto: "2000000" }));
    if (!r.ok) throw new Error(r.error.mensaje);
    expect(r.valor).toEqual([6, 12, 18, 24]);
  });

  it("si la semilla baja el mínimo del plazo adicional, 36 se ofrece desde ahí", () => {
    const j = copiaSemilla();
    j.tasas_mxn.plazo_adicional.aplica_desde_monto = 1000000;
    const r = plazosDisponibles(cargar(j), consulta({ monto: "1000000" }));
    if (!r.ok) throw new Error(r.error.mensaje);
    expect(r.valor).toEqual([6, 12, 18, 24, 36]);
  });
});
