import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Revisión estática de los archivos que llegan al navegador: no deben traer
// el dominio, decimal.js ni la semilla, ni guardar o registrar lo que se escribe.

const CLIENTE = ["src/app/cotizador/Cotizador.tsx", "src/app/cotizador/VistaPrevia.tsx", "src/app/cotizador/textosPantalla.ts"];
const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

/** Importaciones que traen valores (no solo tipos). */
function importacionesDeValor(codigo: string): string[] {
  return [...codigo.matchAll(/^import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]);
}

describe("archivos del navegador", () => {
  it("Cotizador.tsx y VistaPrevia.tsx son componentes de cliente", () => {
    for (const f of CLIENTE.slice(0, 2)) expect(leer(f).startsWith('"use client";')).toBe(true);
  });

  it.each(CLIENTE)("%s no importa valores del dominio, de la aplicación, del servidor, de decimal.js ni de la semilla", (f) => {
    const prohibidas = importacionesDeValor(leer(f)).filter((m) => /domain|aplicacion|servidor|decimal|seed|\.json$/.test(m));
    expect(prohibidas).toEqual([]);
  });

  it.each(CLIENTE)("%s no guarda nada ni registra en la consola", (f) => {
    expect(leer(f)).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|useSearchParams|useRouter|history\.|console\./);
  });

  it("la acción no registra en la consola", () => {
    for (const f of ["src/app/cotizador/acciones.ts", "src/servidor/vistaPrevia.ts", "src/servidor/guardiaHost.ts", "src/proxy.ts"]) {
      expect(leer(f)).not.toMatch(/console\./);
    }
  });

  it("acciones.ts es un archivo de acciones del servidor", () => {
    expect(leer("src/app/cotizador/acciones.ts").startsWith('"use server";')).toBe(true);
  });

  it("la página principal enlaza al cotizador", () => {
    expect(leer("src/app/page.tsx")).toMatch(/href="\/cotizador"/);
  });
});
