import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { argumentosNext, entornoParaNext, exigirUrlLocal } from "../../../scripts/con-entorno.mjs";

const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

function archivosDe(dir: string): string[] {
  return readdirSync(path.join(process.cwd(), dir), { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && /\.(ts|tsx|mjs)$/.test(d.name))
    .map((d) => path.join(d.parentPath, d.name));
}

describe("scripts/con-entorno.mjs", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321"])("acepta la URL local %s", (url) => {
    expect(() => exigirUrlLocal(url)).not.toThrow();
  });

  it.each(["https://abcdefgh.supabase.co", "http://192.168.1.5:54321", "http://localhost.example.com:54321", "no es url"])(
    "se niega con %s y explica por qué en español",
    (url) => {
      expect(() => exigirUrlLocal(url)).toThrow(/local/);
    },
  );

  it("dev y start escuchan solo en 127.0.0.1 y pasan los argumentos extra", () => {
    expect(argumentosNext("dev", [])).toEqual(["dev", "-H", "127.0.0.1"]);
    expect(argumentosNext("start", ["-p", "3200"])).toEqual(["start", "-H", "127.0.0.1", "-p", "3200"]);
    expect(() => argumentosNext("build", [])).toThrow();
  });

  it("las llaves van solo en el entorno del proceso hijo, sin el prefijo NEXT_PUBLIC_", () => {
    const base = { PATH: "x" };
    const entorno = entornoParaNext(base, "http://127.0.0.1:54321", "llave-sintetica");
    expect(entorno).toEqual({ PATH: "x", SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_PUBLISHABLE_KEY: "llave-sintetica" });
    expect(base).toEqual({ PATH: "x" });
    expect(Object.keys(entorno).some((k) => k.startsWith("NEXT_PUBLIC_"))).toBe(false);
  });

  it("no imprime nada en la consola ni escribe archivos", () => {
    const codigo = leer("scripts/con-entorno.mjs");
    expect(codigo).not.toMatch(/console\.(log|info|debug|table|dir)/);
    expect(codigo).not.toMatch(/writeFile|appendFile|createWriteStream|["'`]\.env/);
  });
});

describe("la app no expone Supabase al navegador", () => {
  const fuentes = archivosDe("src").map((f) => [path.relative(process.cwd(), f), readFileSync(f, "utf8")] as const);

  it("ningún archivo de src usa createBrowserClient, getSession, NEXT_PUBLIC_SUPABASE ni llaves secretas", () => {
    const hallazgos = fuentes
      .filter(([, c]) => /createBrowserClient|getSession\(|NEXT_PUBLIC_SUPABASE|service_role|SERVICE_ROLE|SECRET_KEY|sb_secret_/.test(c))
      .map(([f]) => f);
    expect(hallazgos).toEqual([]);
  });

  it("solo src/servidor importa @supabase", () => {
    const fuera = fuentes
      .filter(([f, c]) => /from "@supabase\//.test(c) && !f.split(path.sep).join("/").startsWith("src/servidor/"))
      .map(([f]) => f);
    expect(fuera).toEqual([]);
  });

  it("no hay archivos .env en la raíz", () => {
    expect(readdirSync(process.cwd()).filter((f) => f.startsWith(".env"))).toEqual([]);
  });
});
