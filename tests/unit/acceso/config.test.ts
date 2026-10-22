import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MENSAJE_ENTORNO_INVALIDO,
  MENSAJE_SIN_CONFIG,
  MENSAJE_URL_INVALIDA,
  configSupabase,
  entornoActual,
  hostsPermitidos,
  validarConfiguracionDeArranque,
} from "../../../src/servidor/supabase/config";

const leer = (f: string) => readFileSync(path.join(process.cwd(), f), "utf8");

// Valores sintéticos: ninguno es una llave real.
const URL_SINTETICA = "https://proyecto-sintetico.supabase.co";
const LLAVE_SINTETICA = "llave-publicable-sintetica-0000";

/** El mensaje del error que lanza f (o "" si no lanza). */
function mensajeDe(f: () => unknown): string {
  try {
    f();
    return "";
  } catch (e) {
    return (e as Error).message;
  }
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", URL_SINTETICA);
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", LLAVE_SINTETICA);
  vi.stubEnv("HOSTS_PERMITIDOS", undefined);
  vi.stubEnv("ENTORNO", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("configSupabase", () => {
  it("con las dos variables devuelve la URL y la llave", () => {
    expect(configSupabase()).toEqual({ url: URL_SINTETICA, llavePublicable: LLAVE_SINTETICA });
  });

  it.each([
    ["sin URL", "SUPABASE_URL"],
    ["sin llave", "SUPABASE_PUBLISHABLE_KEY"],
  ])("%s: error en español que dice qué hacer, local y en el despliegue, sin imprimir valores", (_, variable) => {
    vi.stubEnv(variable, undefined);
    const mensaje = mensajeDe(configSupabase);
    expect(mensaje).toBe(MENSAJE_SIN_CONFIG);
    expect(mensaje).toMatch(/npm run dev/);
    expect(mensaje).toMatch(/variables de entorno/);
    expect(mensaje).not.toContain(URL_SINTETICA);
    expect(mensaje).not.toContain(LLAVE_SINTETICA);
  });

  it("vacías cuentan como faltantes", () => {
    vi.stubEnv("SUPABASE_URL", "");
    expect(() => configSupabase()).toThrow(MENSAJE_SIN_CONFIG);
  });

  it.each(["no es url", "ftp://proyecto.supabase.co", "javascript:alert(1)"])("una URL que no es http(s) (%j) da error sin repetirla", (url) => {
    vi.stubEnv("SUPABASE_URL", url);
    const mensaje = mensajeDe(configSupabase);
    expect(mensaje).toBe(MENSAJE_URL_INVALIDA);
    expect(mensaje).not.toContain(url);
  });

  it("no lee variables con el prefijo NEXT_PUBLIC_", () => {
    vi.stubEnv("SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SINTETICA);
    expect(() => configSupabase()).toThrow(MENSAJE_SIN_CONFIG);
  });
});

describe("entornoActual", () => {
  it("por omisión es prueba", () => {
    expect(entornoActual()).toBe("prueba");
  });

  it.each(["prueba", "produccion"] as const)("acepta %j", (valor) => {
    vi.stubEnv("ENTORNO", valor);
    expect(entornoActual()).toBe(valor);
  });

  // El mensaje es una constante: no puede repetir el valor recibido.
  it.each(["", "Produccion", "producción", "production", "prod", " produccion", "dev"])("rechaza %j con el error fijo en español", (valor) => {
    vi.stubEnv("ENTORNO", valor);
    expect(mensajeDe(entornoActual)).toBe(MENSAJE_ENTORNO_INVALIDO);
  });
});

describe("hostsPermitidos", () => {
  it("sin la variable devuelve null (solo locales)", () => {
    expect(hostsPermitidos()).toBeNull();
  });

  it("con la variable devuelve la lista normalizada", () => {
    vi.stubEnv("HOSTS_PERMITIDOS", "Crediflexi-Prueba.vercel.app");
    expect(hostsPermitidos()).toEqual(["crediflexi-prueba.vercel.app"]);
  });

  it("mal formada lanza", () => {
    vi.stubEnv("HOSTS_PERMITIDOS", "*.vercel.app");
    expect(() => hostsPermitidos()).toThrow(/HOSTS_PERMITIDOS/);
  });
});

describe("validarConfiguracionDeArranque (la llama next.config.ts)", () => {
  it("sin variables pasa: locales y entorno de prueba", () => {
    expect(() => validarConfiguracionDeArranque()).not.toThrow();
  });

  it("no exige las variables de Supabase: next build no las necesita", () => {
    vi.stubEnv("SUPABASE_URL", undefined);
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", undefined);
    expect(() => validarConfiguracionDeArranque()).not.toThrow();
  });

  it("con HOSTS_PERMITIDOS mal formada falla el arranque", () => {
    vi.stubEnv("HOSTS_PERMITIDOS", "app.example.com,usuario@evil.com");
    expect(() => validarConfiguracionDeArranque()).toThrow(/HOSTS_PERMITIDOS/);
  });

  it("con ENTORNO desconocido falla el arranque", () => {
    vi.stubEnv("ENTORNO", "production");
    expect(() => validarConfiguracionDeArranque()).toThrow(MENSAJE_ENTORNO_INVALIDO);
  });

  it("con SUPABASE_URL presente pero inválida falla el arranque", () => {
    vi.stubEnv("SUPABASE_URL", "no es url");
    expect(() => validarConfiguracionDeArranque()).toThrow(MENSAJE_URL_INVALIDA);
  });

  it("next.config.ts la llama al cargarse", () => {
    const config = leer("next.config.ts");
    expect(config).toMatch(/import \{ validarConfiguracionDeArranque \} from "\.\/src\/servidor\/supabase\/config";/);
    expect(config).toMatch(/^validarConfiguracionDeArranque\(\);$/m);
  });
});

describe("variables de entorno de la app", () => {
  it("config.ts lee exactamente SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, HOSTS_PERMITIDOS y ENTORNO, ninguna con NEXT_PUBLIC_", () => {
    const codigo = leer("src/servidor/supabase/config.ts");
    const leidas = [...codigo.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]);
    expect([...new Set(leidas)].sort()).toEqual(["ENTORNO", "HOSTS_PERMITIDOS", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_URL"]);
    // Ninguna lectura por corchetes ni con desestructuración que escape a la lista de arriba.
    expect(codigo).not.toMatch(/process\.env\s*\[|=\s*process\.env(?!\.)/);
    expect(codigo).not.toMatch(/process\.env\.NEXT_PUBLIC_/);
  });

  it("ningún mensaje de config.ts interpola valores del entorno", () => {
    const codigo = leer("src/servidor/supabase/config.ts");
    expect(codigo).not.toMatch(/\$\{[^}]*(url|llave|valor|process\.env)[^}]*\}/i);
  });
});
