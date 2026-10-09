import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cargarBenchmark, type Benchmark } from "../aplicacion/benchmark";
import { cargarRazonesSociales } from "../aplicacion/entidades";
import { error, ok, type ResultadoApp } from "../aplicacion/resultado";
import { cargarTextos, type TextosComisiones, type TextosCotizacion, type TextosReclutamiento } from "../aplicacion/textos";
import { cargarSemillaComisiones, type SemillaComisiones } from "../domain/comisiones/semilla";
import { cargarSemilla } from "../domain/tasas/semilla";
import type { Semilla } from "../domain/tasas/semilla.esquema";

export const RUTA_SEMILLA = path.join(process.cwd(), "seed", "parametros_iniciales.json");
export const RUTA_TEXTOS = path.join(process.cwd(), "seed", "textos_cotizacion.json");
export const RUTA_BENCHMARK = path.join(process.cwd(), "seed", "benchmark.json");

export interface RutasParametros {
  readonly semilla: string;
  readonly textos: string;
  readonly benchmark: string;
}

export interface ParametrosCotizacion {
  readonly semilla: Semilla;
  /** Clave de la entidad -> razón social completa. */
  readonly razonesSociales: ReadonlyMap<string, string>;
  readonly textos: TextosCotizacion;
  /** Comparativo de tasas de la página 2 del PDF. */
  readonly benchmark: Benchmark;
}

/** Ruta relativa al proyecto si está dentro de él ("seed/x.json"); si no, la ruta completa. */
function nombreVisible(ruta: string): string {
  const relativa = path.relative(process.cwd(), ruta);
  const dentro = relativa !== "" && !relativa.startsWith("..") && !path.isAbsolute(relativa);
  return (dentro ? relativa : ruta).split(path.sep).join("/");
}

async function leerJson(ruta: string): Promise<ResultadoApp<unknown>> {
  const nombre = nombreVisible(ruta);
  let texto: string;
  try {
    texto = await readFile(ruta, "utf8");
  } catch (e) {
    const codigo = (e as NodeJS.ErrnoException).code;
    const motivo = codigo === "ENOENT" ? "no existe" : `no se pudo abrir (${codigo ?? "error desconocido"})`;
    return error(
      "ARCHIVO_ILEGIBLE",
      `No se pudo leer el archivo ${nombre}: ${motivo}. Verifica que esté en esa ubicación y vuelve a intentarlo.`,
    );
  }
  try {
    // Algunos editores de Windows guardan el archivo con BOM; JSON.parse no lo acepta.
    return ok(JSON.parse(texto.replace(/^\uFEFF/, "")));
  } catch (e) {
    return error(
      "ARCHIVO_ILEGIBLE",
      `El archivo ${nombre} no es JSON válido (${(e as Error).message}). Corrige el formato y vuelve a intentarlo.`,
    );
  }
}

/**
 * Lee en cada llamada la semilla, los textos y el comparativo desde disco y
 * los valida. No guarda nada en memoria: un cambio en los archivos se ve en la
 * siguiente llamada, sin reconstruir la app.
 */
export async function leerParametrosCotizacion(
  rutas: RutasParametros = { semilla: RUTA_SEMILLA, textos: RUTA_TEXTOS, benchmark: RUTA_BENCHMARK },
): Promise<ResultadoApp<ParametrosCotizacion>> {
  const [jsonSemilla, jsonTextos, jsonBenchmark] = await Promise.all([
    leerJson(rutas.semilla),
    leerJson(rutas.textos),
    leerJson(rutas.benchmark),
  ]);
  if (!jsonSemilla.ok) return jsonSemilla;
  if (!jsonTextos.ok) return jsonTextos;
  if (!jsonBenchmark.ok) return jsonBenchmark;

  const semilla = cargarSemilla(jsonSemilla.valor);
  if (!semilla.ok) {
    return error(
      "SEMILLA_INVALIDA",
      `${nombreVisible(rutas.semilla)}: ${semilla.error.mensaje}`,
      semilla.error.detalles,
    );
  }

  const razonesSociales = cargarRazonesSociales(jsonSemilla.valor, nombreVisible(rutas.semilla));
  if (!razonesSociales.ok) return razonesSociales;

  const textos = cargarTextos(jsonTextos.valor, nombreVisible(rutas.textos));
  if (!textos.ok) return textos;

  const benchmark = cargarBenchmark(jsonBenchmark.valor, nombreVisible(rutas.benchmark));
  if (!benchmark.ok) return benchmark;

  return ok({ semilla: semilla.valor, razonesSociales: razonesSociales.valor, textos: textos.valor, benchmark: benchmark.valor });
}

/**
 * Lee en cada llamada la parte de comisiones de la semilla (tablas, parámetros
 * e incentivos). Va aparte de leerParametrosCotizacion: un error en las tablas
 * de comisión no detiene al cotizador.
 */
export async function leerSemillaComisiones(ruta: string = RUTA_SEMILLA): Promise<ResultadoApp<SemillaComisiones>> {
  const json = await leerJson(ruta);
  if (!json.ok) return json;
  const s = cargarSemillaComisiones(json.valor);
  if (!s.ok) return error("SEMILLA_INVALIDA", `${nombreVisible(ruta)}: ${s.error.mensaje}`, s.error.detalles);
  return ok(s.valor);
}

/** Lee en cada llamada los textos del simulador /comisiones (bloque comisiones del archivo de textos). */
export async function leerTextosComisiones(ruta: string = RUTA_TEXTOS): Promise<ResultadoApp<TextosComisiones>> {
  const json = await leerJson(ruta);
  if (!json.ok) return json;
  const textos = cargarTextos(json.valor, nombreVisible(ruta));
  if (!textos.ok) return textos;
  return ok(textos.valor.comisiones);
}

export interface ParametrosReclutamiento {
  readonly semilla: SemillaComisiones;
  readonly textos: TextosReclutamiento;
}

/** Lee en cada llamada la semilla de comisiones y los textos del modo reclutamiento. */
export async function leerParametrosReclutamiento(
  rutas: { readonly semilla: string; readonly textos: string } = { semilla: RUTA_SEMILLA, textos: RUTA_TEXTOS },
): Promise<ResultadoApp<ParametrosReclutamiento>> {
  const [semilla, jsonTextos] = await Promise.all([leerSemillaComisiones(rutas.semilla), leerJson(rutas.textos)]);
  if (!semilla.ok) return semilla;
  if (!jsonTextos.ok) return jsonTextos;
  const textos = cargarTextos(jsonTextos.valor, nombreVisible(rutas.textos));
  if (!textos.ok) return textos;
  return ok({ semilla: semilla.valor, textos: textos.valor.reclutamiento });
}
