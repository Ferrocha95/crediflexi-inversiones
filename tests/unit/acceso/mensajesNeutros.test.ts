import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { MENSAJES_ACCESO } = await import("../../../src/aplicacion/acceso/mensajes");
const { MENSAJES_BIBLIOTECA } = await import("../../../src/aplicacion/biblioteca/reglas");
const { MENSAJES_EXCEL } = await import("../../../src/aplicacion/excel/archivo");
const { MENSAJE_ERROR_DESCONOCIDO } = await import("../../../src/aplicacion/pipeline/errores");
const { MENSAJE_ERROR_LECTURA_PIPELINE } = await import("../../../src/servidor/pipeline/consultas");
const { MENSAJE_ERROR_LECTURA } = await import("../../../src/servidor/sesion");

/** Palabras que un texto de cara al usuario no debe traer: hablan de la versión local o de comandos. */
const PROHIBIDAS = [/local/i, /npm/i, /db:start/i, /localhost/i, /127\.0\.0\.1/];

/** La primera palabra prohibida que trae el texto, o null. */
function prohibida(texto: string): string | null {
  return PROHIBIDAS.find((re) => re.test(texto))?.source ?? null;
}

/** Todas las cadenas dentro de un valor (objetos y arreglos anidados), con su ruta. */
function cadenas(valor: unknown, ruta: string): [string, string][] {
  if (typeof valor === "string") return [[ruta, valor]];
  if (Array.isArray(valor)) return valor.flatMap((v, i) => cadenas(v, `${ruta}[${i}]`));
  if (valor !== null && typeof valor === "object") return Object.entries(valor).flatMap(([k, v]) => cadenas(v, `${ruta}.${k}`));
  return [];
}

// Los mensajes de falla de la base o del almacenamiento salen también en la
// nube: no deben pedir revisar Supabase local ni correr comandos.
const MENSAJES: [string, string][] = [
  ["acceso.sinServicio", MENSAJES_ACCESO.sinServicio],
  ["biblioteca.fallaAlmacenamiento", MENSAJES_BIBLIOTECA.fallaAlmacenamiento],
  ["biblioteca.fallaLectura", MENSAJES_BIBLIOTECA.fallaLectura],
  ["excel.fallaLectura", MENSAJES_EXCEL.fallaLectura],
  ["pipeline.MENSAJE_ERROR_DESCONOCIDO", MENSAJE_ERROR_DESCONOCIDO],
  ["pipeline.MENSAJE_ERROR_LECTURA_PIPELINE", MENSAJE_ERROR_LECTURA_PIPELINE],
  ["sesion.MENSAJE_ERROR_LECTURA", MENSAJE_ERROR_LECTURA],
];

describe("mensajes de falla de la base, neutros", () => {
  it.each(MENSAJES)("%s no menciona local, localhost, 127.0.0.1, Supabase ni comandos", (_, mensaje) => {
    for (const re of [...PROHIBIDAS, /supabase/i, /corriendo/i]) expect(mensaje, String(re)).not.toMatch(re);
  });

  it.each(MENSAJES)("%s dice qué falló y qué hacer: reintentar y avisar a quien administra el sistema", (_, mensaje) => {
    expect(mensaje).toMatch(/^No se pudo /);
    expect(mensaje).toMatch(/\. (Vuelve a intentar|Recarga la página) en unos minutos; /);
    expect(mensaje).toMatch(/si sigue igual, avisa a quien administra el sistema\.$/);
  });

  it("ningún archivo de src, salvo src/servidor/supabase/config.ts, dice «Supabase local» ni pide npm run db:start", async () => {
    const { readdirSync } = await import("node:fs");
    const SRC = path.join(process.cwd(), "src");
    const hallazgos = readdirSync(SRC, { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile() && /\.(ts|tsx)$/.test(d.name))
      .map((d) => path.join(d.parentPath, d.name))
      .map((f) => [path.relative(process.cwd(), f).split(path.sep).join("/"), readFileSync(f, "utf8")] as const)
      .filter(([f]) => f !== "src/servidor/supabase/config.ts")
      .filter(([, c]) => /Supabase local esté|npm run db:start/.test(c))
      .map(([f]) => f);
    expect(hallazgos).toEqual([]);
  });
});

// Lo que el usuario puede leer: los valores de seed/textos_cotizacion.json, los
// textosPantalla.ts, los módulos de textos de src/componentes y las constantes
// de mensajes (reglas.ts, errores.ts y mensajes.ts). Se importan y se recorren
// sus valores exportados, así solo cuentan las cadenas reales, no comentarios
// ni rutas de import. Ninguna excepción hace falta hoy: si alguna aparece,
// va en EXCEPCIONES con su justificación. src/domain/comun/errores.ts y
// src/domain/comisiones/errores.ts no entran: solo exportan tipos y funciones,
// no constantes de mensajes (cada mensaje lo arma quien crea el error).
const MODULOS = [
  "src/aplicacion/acceso/mensajes.ts",
  "src/aplicacion/biblioteca/reglas.ts",
  "src/aplicacion/pipeline/errores.ts",
  "src/app/(app)/comisiones/textosPantalla.ts",
  "src/app/(app)/cotizador/textosPantalla.ts",
  "src/app/(app)/pipeline/textosPantalla.ts",
  "src/componentes/acceso/textos.ts",
  "src/componentes/estructura/textos.ts",
];

/** Rutas (archivo + ruta del valor) que se permiten aunque traigan una palabra prohibida, cada una justificada. */
const EXCEPCIONES: Record<string, string> = {};

describe("textos de cara al usuario sin «local», «npm», «db:start», «localhost» ni «127.0.0.1»", () => {
  it("el detector marca una cadena falsa y deja pasar una neutra", () => {
    expect(prohibida("Corre npm run db:start en http://localhost:3000")).not.toBeNull();
    expect(prohibida("Abre http://127.0.0.1:3000")).not.toBeNull();
    expect(prohibida("Versión solo LOCAL")).not.toBeNull();
    expect(prohibida("No se pudo leer el pipeline. Vuelve a intentar en unos minutos.")).toBeNull();
    // Y el recorrido encuentra una cadena anidada.
    const falsas = cadenas({ a: { b: ["ok", "usa localhost"] } }, "falso").filter(([, t]) => prohibida(t) !== null);
    expect(falsas).toEqual([["falso.a.b[1]", "usa localhost"]]);
  });

  it("seed/textos_cotizacion.json: ningún valor", () => {
    const json: unknown = JSON.parse(readFileSync(path.join(process.cwd(), "seed", "textos_cotizacion.json"), "utf8").replace(new RegExp("^" + String.fromCharCode(0xfeff)), ""));
    const todas = cadenas(json, "seed/textos_cotizacion.json");
    expect(todas.length).toBeGreaterThan(100);
    expect(todas.filter(([r, t]) => prohibida(t) !== null && !(r in EXCEPCIONES))).toEqual([]);
  });

  it.each(MODULOS)("%s: ningún valor exportado", async (archivo) => {
    const modulo: Record<string, unknown> = await import(path.join(process.cwd(), archivo));
    const todas = Object.entries(modulo).flatMap(([nombre, valor]) => cadenas(valor, `${archivo}:${nombre}`));
    expect(todas.length).toBeGreaterThan(0);
    expect(todas.filter(([r, t]) => prohibida(t) !== null && !(r in EXCEPCIONES))).toEqual([]);
  });

  it("cada excepción tiene justificación", () => {
    for (const [ruta, porque] of Object.entries(EXCEPCIONES)) expect(porque.length, ruta).toBeGreaterThan(20);
  });
});
