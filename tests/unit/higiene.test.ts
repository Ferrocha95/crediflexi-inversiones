import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

describe("higiene del proyecto", () => {
  it("dev y start pasan por scripts/con-entorno.mjs, que escucha solo en 127.0.0.1", () => {
    const { scripts } = JSON.parse(leer("package.json")) as { scripts: Record<string, string> };
    expect(scripts.dev).toBe("node scripts/con-entorno.mjs dev");
    expect(scripts.start).toBe("node scripts/con-entorno.mjs start");
    expect(leer("scripts/con-entorno.mjs")).toMatch(/"-H", "127\.0\.0\.1"/);
  });

  it(".gitignore excluye los PDF y la carpeta de Playwright MCP", () => {
    const lineas = leer(".gitignore").split(/\r?\n/);
    expect(lineas).toContain("*.pdf");
    expect(lineas).toContain(".playwright-mcp/");
  });

  it("README.md dice que es solo local y cómo correr la app y las pruebas", () => {
    const readme = leer("README.md");
    expect(readme).toMatch(/solo local/i);
    expect(readme).toMatch(/no (se debe )?desplegar/i);
    for (const comando of ["npm run dev", "npm run test:unit", "npm run test:rls", "npm run db:start"]) {
      expect(readme).toContain(comando);
    }
    expect(readme).toMatch(/Supabase local/);
  });

  it("PENDIENTES_TECNICOS.md trae los pendientes ii, jj y kk", () => {
    const pendientes = leer("PENDIENTES_TECNICOS.md");
    expect(pendientes).toMatch(/^- \(ii\) .*Playwright/m);
    expect(pendientes).toMatch(/^- \(jj\) .*estatus del tramo/m);
    expect(pendientes).toMatch(/^- \(kk\) .*aviso fabricado a mano/m);
  });
});
