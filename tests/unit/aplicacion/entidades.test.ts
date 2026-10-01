import { describe, expect, it } from "vitest";
import semillaJson from "../../../seed/parametros_iniciales.json";
import { cargarRazonesSociales } from "../../../src/aplicacion/entidades";

const ARCHIVO = "seed/parametros_iniciales.json";

function errorDe(json: unknown): string {
  const r = cargarRazonesSociales(json, ARCHIVO);
  if (r.ok) throw new Error("Se esperaba que la carga fallara");
  expect(r.error.codigo).toBe("ENTIDADES_INVALIDAS");
  expect(r.error.mensaje).toContain(ARCHIVO);
  return [r.error.mensaje, ...(r.error.detalles ?? [])].join("\n");
}

describe("cargarRazonesSociales", () => {
  it("lee la razón social de las dos entidades de la semilla real", () => {
    const r = cargarRazonesSociales(semillaJson, ARCHIVO);
    if (!r.ok) throw new Error(r.error.mensaje);
    expect([...r.valor.entries()]).toEqual([
      ["CREDIFLEXI", "CREDIFLEXI, S.A.P.I. DE C.V."],
      ["RAMI_SISE", "RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R."],
    ]);
  });

  it("ignora los demás campos de la semilla", () => {
    const r = cargarRazonesSociales(
      { entidades: [{ clave: "ENTIDAD_SINTETICA", razon_social: "ENTIDAD SINTÉTICA, S.A.", nota: "x" }], otra: 1 },
      ARCHIVO,
    );
    expect(r.ok).toBe(true);
  });

  it("una entidad sin razón social rompe la carga y dice cuál", () => {
    expect(errorDe({ entidades: [{ clave: "ENTIDAD_SINTETICA" }] })).toContain("entidades.0.razon_social");
  });

  it("una razón social vacía rompe la carga", () => {
    expect(errorDe({ entidades: [{ clave: "ENTIDAD_SINTETICA", razon_social: "  " }] })).toContain(
      "entidades.0.razon_social",
    );
  });

  it("una clave repetida rompe la carga", () => {
    expect(
      errorDe({
        entidades: [
          { clave: "ENTIDAD_SINTETICA", razon_social: "UNO, S.A." },
          { clave: "ENTIDAD_SINTETICA", razon_social: "DOS, S.A." },
        ],
      }),
    ).toContain("ENTIDAD_SINTETICA");
  });

  it("sin entidades rompe la carga", () => {
    expect(errorDe({ entidades: [] })).toContain("entidades");
  });
});
