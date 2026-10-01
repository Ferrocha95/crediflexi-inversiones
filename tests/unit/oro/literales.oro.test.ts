import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Prueba estática: ninguna tasa vive en el código del dominio (regla 4).
 * Busca literales con forma de tasa (entre 0.05 y 0.30 con al menos dos
 * decimales) en src/domain, sin contar pruebas. Usa el analizador de
 * TypeScript para revisar solo literales numéricos y textos que son
 * exclusivamente un número ("0.175"); un ejemplo dentro de un mensaje
 * ("por ejemplo \"0.175\" para 17.5%") no cuenta.
 */
const RAIZ = join(__dirname, "..", "..", "..");
const DOMINIO = join(RAIZ, "src", "domain");
const RE_FORMA_DE_TASA = /^0?\.\d{2,}$/;

function archivosTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return archivosTs(ruta);
    return e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") ? [ruta] : [];
  });
}

function literalesConFormaDeTasa(nombre: string, codigo: string): string[] {
  const fuente = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true);
  const hallazgos: string[] = [];
  const visitar = (nodo: ts.Node): void => {
    let texto: string | null = null;
    if (ts.isNumericLiteral(nodo)) texto = nodo.getText(fuente);
    else if (ts.isStringLiteral(nodo) || ts.isNoSubstitutionTemplateLiteral(nodo)) texto = nodo.text.trim();
    if (texto !== null && RE_FORMA_DE_TASA.test(texto)) {
      const valor = Number(texto);
      if (valor >= 0.05 && valor <= 0.3) {
        const { line } = fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente));
        hallazgos.push(`${nombre}:${line + 1} ${texto}`);
      }
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return hallazgos;
}

describe("oro (extra): sin tasas escritas en src/domain", () => {
  const archivos = archivosTs(DOMINIO);

  it("revisa los archivos del dominio", () => {
    expect(archivos.length).toBeGreaterThan(5);
  });

  it("detecta un literal con forma de tasa (control de la propia prueba)", () => {
    const codigo = 'const a = 0.175; const b = "0.19"; const c = 12; const d = 0.5; const e = "por ejemplo 0.175";';
    expect(literalesConFormaDeTasa("x.ts", codigo)).toEqual(["x.ts:1 0.175", "x.ts:1 0.19"]);
  });

  it("no hay literales con forma de tasa", () => {
    expect(
      archivos.flatMap((a) => literalesConFormaDeTasa(relative(RAIZ, a), readFileSync(a, "utf8"))),
    ).toEqual([]);
  });
});
