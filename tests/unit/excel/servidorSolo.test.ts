import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// exceljs solo se usa en el servidor: nunca debe llegar al navegador.

const fuentes = readdirSync(path.join(process.cwd(), "src"), { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && /\.(ts|tsx|mjs)$/.test(d.name))
  .map((d) => path.join(d.parentPath, d.name))
  .map((f) => [path.relative(process.cwd(), f).split(path.sep).join("/"), readFileSync(f, "utf8")] as const);

const importanExcel = fuentes.filter(([, c]) => /from\s+["']exceljs["']|require\(["']exceljs["']\)/.test(c));

describe("exceljs solo en el servidor", () => {
  it("solo archivos de src/servidor/excel importan exceljs", () => {
    expect(importanExcel.map(([f]) => f).sort()).toEqual(["src/servidor/excel/importar.ts", "src/servidor/excel/pipeline.ts"]);
  });

  it.each(importanExcel.map(([f]) => f))("%s importa server-only", (f) => {
    const codigo = fuentes.find(([g]) => g === f)![1];
    expect(codigo).toMatch(/^import "server-only";/m);
  });

  it("ningún componente de cliente importa src/servidor/excel", () => {
    const clientes = fuentes.filter(([, c]) => /^["']use client["'];/.test(c));
    // Solo cuentan las importaciones (un comentario puede nombrar el archivo).
    expect(clientes.filter(([, c]) => /from\s+["'][^"']*servidor\/excel/.test(c)).map(([f]) => f)).toEqual([]);
  });
});
