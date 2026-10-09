import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import textosJson from "../../../seed/textos_cotizacion.json";
import { TEXTOS } from "../../../src/app/(app)/comisiones/textosPantalla";

// Revisión estática de los archivos de /comisiones que llegan al navegador: no
// traen el dominio, decimal.js ni la semilla, ni guardan lo que se escribe.

const CLIENTE = [
  "src/app/(app)/comisiones/Simulador.tsx",
  "src/app/(app)/comisiones/Resultado.tsx",
  "src/app/(app)/comisiones/textosPantalla.ts",
  "src/app/(app)/comisiones/reclutamiento/Reclutamiento.tsx",
  "src/app/(app)/comisiones/plantilla.ts",
];
const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

/** Todos los textos fijos de /comisiones: los de la pantalla y el bloque comisiones del archivo de textos. */
function textosDeLaPantalla(): string {
  const deLaPantalla = Object.values(TEXTOS).map((v) =>
    typeof v === "function" ? String((v as (...a: string[]) => string)("X", "Y", "Z")) : String(v),
  );
  return [...deLaPantalla, ...Object.values(textosJson.comisiones)].join("\n");
}

function importacionesDeValor(codigo: string): string[] {
  return [...codigo.matchAll(/^import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
}

/** Lenguaje de promesa que no puede aparecer en el simulador. */
const RE_PROMESA = /(?<![\p{L}\p{N}])(garantiz\p{L}*|asegur\p{L}*|sin riesgo|ingreso fijo|ganar[aá]s|recibir[aá]s|promesa)(?![\p{L}\p{N}])/iu;

describe("archivos del navegador de /comisiones", () => {
  it("Simulador.tsx, Resultado.tsx y Reclutamiento.tsx son componentes de cliente", () => {
    for (const f of [...CLIENTE.slice(0, 2), CLIENTE[3]]) expect(leer(f).startsWith('"use client";')).toBe(true);
  });

  it.each(CLIENTE)("%s no importa valores del dominio, de la aplicación, del servidor, de decimal.js ni de la semilla", (f) => {
    const prohibidas = importacionesDeValor(leer(f)).filter((m) => /domain|aplicacion|servidor|decimal|seed|\.json$/.test(m));
    expect(prohibidas).toEqual([]);
  });

  it.each(CLIENTE)("%s no guarda nada ni registra en la consola", (f) => {
    expect(leer(f)).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|useSearchParams|useRouter|history\.|console\./);
  });

  it("la acción y el módulo del servidor no registran en la consola", () => {
    for (const f of [
      "src/app/(app)/comisiones/acciones.ts",
      "src/servidor/comisiones.ts",
      "src/app/(app)/comisiones/reclutamiento/acciones.ts",
      "src/servidor/reclutamiento.ts",
      "src/servidor/pdf/manejadorReclutamiento.ts",
    ]) expect(leer(f)).not.toMatch(/console\./);
  });

  it("los textos de la pantalla no usan lenguaje de promesa", () => {
    expect(textosDeLaPantalla()).not.toMatch(RE_PROMESA);
  });

  it("ningún texto de la pantalla de comisiones dice 'sin límite', 'estadía' ni 'permanencia' (Sprint 6c)", () => {
    const todos = textosDeLaPantalla();
    expect(todos).toContain("En adelante");
    expect(todos).not.toMatch(/sin l[ií]mite|estad[ií]a|permanencia/i);
  });

  it("los cumplimientos no van en mayúsculas tipo '100% META'", () => {
    expect(textosDeLaPantalla()).not.toMatch(/\d+% META/);
  });
});
