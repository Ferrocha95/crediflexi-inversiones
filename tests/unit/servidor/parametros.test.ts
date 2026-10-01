import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import textosJson from "../../../seed/textos_cotizacion.json";
import {
  leerParametrosCotizacion,
  RUTA_SEMILLA,
  RUTA_TEXTOS,
} from "../../../src/servidor/parametros";

let carpeta: string;

beforeAll(async () => {
  carpeta = await mkdtemp(path.join(tmpdir(), "crediflexi-parametros-"));
});

afterAll(async () => {
  await rm(carpeta, { recursive: true, force: true });
});

async function archivo(nombre: string, contenido: string): Promise<string> {
  const ruta = path.join(carpeta, nombre);
  await writeFile(ruta, contenido, "utf8");
  return ruta;
}

describe("leerParametrosCotizacion", () => {
  it("las rutas por defecto apuntan a la carpeta seed del proyecto", () => {
    expect(RUTA_SEMILLA).toBe(path.join(process.cwd(), "seed", "parametros_iniciales.json"));
    expect(RUTA_TEXTOS).toBe(path.join(process.cwd(), "seed", "textos_cotizacion.json"));
  });

  it("lee la semilla, las razones sociales y los textos reales", async () => {
    const r = await leerParametrosCotizacion();
    if (!r.ok) throw new Error(r.error.mensaje);
    expect(r.valor.semilla.version).toBe("0.3");
    expect(r.valor.semilla.generado).toBe("2026-10-01");
    expect(r.valor.semilla.entidades).toEqual(["CREDIFLEXI", "RAMI_SISE"]);
    expect(r.valor.razonesSociales.get("CREDIFLEXI")).toBe("CREDIFLEXI, S.A.P.I. DE C.V.");
    expect(r.valor.razonesSociales.get("RAMI_SISE")).toBe("RAMI SISE, S.A.P.I. DE C.V., SOFOM, E.N.R.");
    expect(r.valor.textos.version).toBe("0.2");
  });

  it("si falta el archivo de la semilla, lo dice en español", async () => {
    const r = await leerParametrosCotizacion({ semilla: path.join(carpeta, "no_existe.json"), textos: RUTA_TEXTOS });
    if (r.ok) throw new Error("Se esperaba un error");
    expect(r.error.codigo).toBe("ARCHIVO_ILEGIBLE");
    expect(r.error.mensaje).toContain("no_existe.json");
    expect(r.error.mensaje).toMatch(/no existe/);
  });

  it("si la semilla no es JSON válido, lo dice en español", async () => {
    const ruta = await archivo("semilla_rota.json", "{ esto no es json");
    const r = await leerParametrosCotizacion({ semilla: ruta, textos: RUTA_TEXTOS });
    if (r.ok) throw new Error("Se esperaba un error");
    expect(r.error.codigo).toBe("ARCHIVO_ILEGIBLE");
    expect(r.error.mensaje).toContain("semilla_rota.json");
    expect(r.error.mensaje).toMatch(/JSON/);
  });

  it("si la semilla no pasa la validación del dominio, devuelve SEMILLA_INVALIDA con detalles", async () => {
    const ruta = await archivo("semilla_invalida.json", JSON.stringify({ version: "0.0" }));
    const r = await leerParametrosCotizacion({ semilla: ruta, textos: RUTA_TEXTOS });
    if (r.ok) throw new Error("Se esperaba un error");
    expect(r.error.codigo).toBe("SEMILLA_INVALIDA");
    expect((r.error.detalles ?? []).length).toBeGreaterThan(0);
  });

  it("si el archivo de textos tiene un marcador desconocido, falla con el archivo y el marcador", async () => {
    const ruta = await archivo(
      "textos_cotizacion.json",
      JSON.stringify({ ...textosJson, linea_vigencia: "Vigente hasta {fecha_limite}." }),
    );
    const r = await leerParametrosCotizacion({ semilla: RUTA_SEMILLA, textos: ruta });
    if (r.ok) throw new Error("Se esperaba un error");
    expect(r.error.codigo).toBe("TEXTOS_INVALIDOS");
    expect(r.error.mensaje).toContain("textos_cotizacion.json");
    expect((r.error.detalles ?? []).join("\n")).toContain("{fecha_limite}");
  });

  it("si falta el archivo de textos, lo dice en español", async () => {
    const r = await leerParametrosCotizacion({ semilla: RUTA_SEMILLA, textos: path.join(carpeta, "sin_textos.json") });
    if (r.ok) throw new Error("Se esperaba un error");
    expect(r.error.codigo).toBe("ARCHIVO_ILEGIBLE");
    expect(r.error.mensaje).toContain("sin_textos.json");
  });
});
