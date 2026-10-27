import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// next/font/local no corre fuera de Next: la fuente no importa aquí.
vi.mock("../../src/app/fuentes", () => ({ nunito: { variable: "" } }));

const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8").replace(/\r/g, "");

// Rutas que generan un PDF o un Excel: las más lentas. Vercel deja configurar
// maxDuration (Hobby: hasta 300 s, documentación de Vercel, Functions Limits);
// se fija en 60 s, decisión de Fernando.
const RUTAS_LENTAS = [
  "src/app/(app)/cotizador/pdf/route.ts",
  "src/app/(app)/comisiones/pdf/route.ts",
  "src/app/(app)/comisiones/reclutamiento/pdf/route.ts",
  "src/app/(app)/pipeline/excel/route.ts",
  "src/app/(app)/pipeline/importar/route.ts",
];

describe("maxDuration", () => {
  it.each(RUTAS_LENTAS)("%s exporta maxDuration = 60", (f) => {
    const coincidencias = leer(f).match(/^export const maxDuration = (\d+);$/gm) ?? [];
    expect(coincidencias).toEqual(["export const maxDuration = 60;"]);
  });
});

describe("noindex", () => {
  it("el layout raíz pide a los buscadores no indexar ni seguir enlaces", async () => {
    const { metadata } = await import("../../src/app/layout");
    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false, noimageindex: true },
    });
  });

  it("public/robots.txt prohíbe todo a todos", () => {
    expect(leer("public/robots.txt")).toBe("User-agent: *\nDisallow: /\n");
  });

  it("/robots.txt se sirve sin sesión (es un archivo público)", async () => {
    const { rutaSinRefresco } = await import("../../src/aplicacion/acceso/rutas");
    expect(rutaSinRefresco("/robots.txt")).toBe(true);
  });
});
