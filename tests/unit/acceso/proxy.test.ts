import { readdirSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Cliente falso de Supabase: getClaims responde según el escenario y, como el
// real, puede llamar a setAll con cookies nuevas y encabezados de caché.
const escenario = vi.hoisted(() => ({ conSesion: false, refresca: false }));
const crearCliente = vi.hoisted(() => vi.fn());

vi.mock("@supabase/ssr", () => ({
  createServerClient: crearCliente.mockImplementation(
    (_url: string, _llave: string, opciones: { cookies: { setAll: (c: unknown[], h: Record<string, string>) => void } }) => ({
      auth: {
        getClaims: async () => {
          if (escenario.refresca) {
            opciones.cookies.setAll([{ name: "sb-local-auth-token", value: "renovada", options: { path: "/" } }], {
              "cache-control": "private, no-cache, no-store, must-revalidate, max-age=0",
              pragma: "no-cache",
            });
          }
          return escenario.conSesion
            ? { data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } }, error: null }
            : { data: null, error: null };
        },
      },
    }),
  ),
}));

const { proxy } = await import("../../../src/proxy");
const { actualizarSesion } = await import("../../../src/servidor/supabase/proxy");
const { ARCHIVOS_PUBLICOS, rutaSinRefresco } = await import("../../../src/aplicacion/acceso/rutas");
const { configSupabase } = await import("../../../src/servidor/supabase/config");
const { MENSAJE_SESION_EXPIRADA } = await import("../../../src/componentes/acceso/textos");

const peticion = (ruta: string, host = "127.0.0.1:3000") =>
  new NextRequest(`http://127.0.0.1:3000${ruta}`, { headers: { host } });

beforeEach(() => {
  escenario.conSesion = false;
  escenario.refresca = false;
  crearCliente.mockClear();
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "llave-sintetica-de-prueba");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("rutaSinRefresco", () => {
  it.each([
    "/acceso",
    "/acceso/salir",
    "/_next/static/chunks/app.js",
    "/_next/image",
    "/favicon.ico",
    "/logo-blanco.png",
    "/logo-crediflexi.png",
    "/logo-encabezado-excel.png",
    "/logos-crediflexi-rami-sise.png",
  ])("%s queda fuera del refresco de sesión", (ruta) => {
    expect(rutaSinRefresco(ruta)).toBe(true);
  });

  it.each(["/", "/cotizador", "/cotizador/pdf", "/diseno", "/accesos", "/acceso-falso", "/_next/data/x.json", "/logo-blanco.png/x", "/otro.png"])(
    "%s pide sesión",
    (ruta) => {
      expect(rutaSinRefresco(ruta)).toBe(false);
    },
  );

  it("la lista de archivos públicos coincide con la carpeta public", () => {
    const enDisco = readdirSync(path.join(process.cwd(), "public"), { recursive: true, withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => `/${path.relative(path.join(process.cwd(), "public"), path.join(d.parentPath, d.name)).split(path.sep).join("/")}`)
      .sort();
    expect([...ARCHIVOS_PUBLICOS].sort()).toEqual(enDisco);
  });
});

describe("actualizarSesion", () => {
  it("sin sesión redirige a /acceso con la ruta y la consulta en siguiente", async () => {
    const r = await actualizarSesion(peticion("/cotizador?monto=50000&plazo=12"));
    expect(r.status).toBe(307);
    const destino = new URL(r.headers.get("location")!);
    expect(destino.pathname).toBe("/acceso");
    expect(destino.searchParams.get("siguiente")).toBe("/cotizador?monto=50000&plazo=12");
  });

  it("en la raíz sin sesión redirige a /acceso sin siguiente", async () => {
    const r = await actualizarSesion(peticion("/"));
    expect(r.status).toBe(307);
    const destino = new URL(r.headers.get("location")!);
    expect(destino.pathname).toBe("/acceso");
    expect(destino.searchParams.has("siguiente")).toBe(false);
  });

  it("la redirección conserva las cookies y los encabezados de caché que dio setAll", async () => {
    escenario.refresca = true;
    const r = await actualizarSesion(peticion("/cotizador"));
    expect(r.status).toBe(307);
    expect(r.cookies.get("sb-local-auth-token")?.value).toBe("renovada");
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("con sesión deja pasar y devuelve las cookies renovadas con sus encabezados", async () => {
    escenario.conSesion = true;
    escenario.refresca = true;
    const r = await actualizarSesion(peticion("/cotizador"));
    expect(r.status).toBe(200);
    expect(r.headers.get("location")).toBeNull();
    expect(r.cookies.get("sb-local-auth-token")?.value).toBe("renovada");
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
    expect(r.headers.get("pragma")).toBe("no-cache");
  });

  it.each(["/acceso", "/acceso/salir", "/_next/static/chunks/app.js", "/_next/image?url=%2Flogo-blanco.png&w=640&q=75", "/favicon.ico", "/logo-blanco.png"])(
    "%s pasa sin crear cliente de Supabase",
    async (ruta) => {
      const r = await actualizarSesion(peticion(ruta));
      expect(r.status).toBe(200);
      expect(crearCliente).not.toHaveBeenCalled();
    },
  );
});

describe("actualizarSesion: peticiones que no son de navegación", () => {
  const post = (ruta: string, encabezados: Record<string, string> = {}) =>
    new NextRequest(`http://127.0.0.1:3000${ruta}`, {
      method: "POST",
      headers: { host: "127.0.0.1:3000", "content-type": "application/json", ...encabezados },
      body: "{}",
    });

  it("un POST sin sesión (el PDF) recibe 401 con texto en español, no una redirección a HTML", async () => {
    const r = await actualizarSesion(post("/cotizador/pdf"));
    expect(r.status).toBe(401);
    expect(r.headers.get("location")).toBeNull();
    expect(await r.text()).toBe(MENSAJE_SESION_EXPIRADA);
  });

  it("el 401 es text/plain exacto: así Next pasa el mensaje a la acción que falló", async () => {
    const r = await actualizarSesion(post("/cotizador", { "next-action": "abc123" }));
    expect(r.status).toBe(401);
    expect(r.headers.get("content-type")).toBe("text/plain");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("una petición con Next-Action sin sesión recibe 401 aunque no sea POST", async () => {
    const r = await actualizarSesion(new NextRequest("http://127.0.0.1:3000/cotizador", { headers: { host: "127.0.0.1:3000", "next-action": "abc123" } }));
    expect(r.status).toBe(401);
  });

  it("el 401 conserva las cookies y los encabezados de caché que dio setAll", async () => {
    escenario.refresca = true;
    const r = await actualizarSesion(post("/cotizador/pdf"));
    expect(r.status).toBe(401);
    expect(r.cookies.get("sb-local-auth-token")?.value).toBe("renovada");
  });

  it("un GET sin sesión sigue redirigiendo a /acceso", async () => {
    expect((await actualizarSesion(peticion("/cotizador"))).status).toBe(307);
  });

  it("con sesión, un POST pasa", async () => {
    escenario.conSesion = true;
    expect((await actualizarSesion(post("/cotizador/pdf"))).status).toBe(200);
  });
});

describe("proxy", () => {
  it("un Host no local sigue dando 403 antes de todo, sin tocar Supabase", async () => {
    const r = await proxy(peticion("/cotizador", "ejemplo.com"));
    expect(r.status).toBe(403);
    expect(crearCliente).not.toHaveBeenCalled();
  });

  it("un Host no local da 403 también en /acceso y en los estáticos", async () => {
    for (const ruta of ["/acceso", "/_next/static/chunks/app.js", "/logo-blanco.png"]) {
      expect((await proxy(peticion(ruta, "ejemplo.com"))).status).toBe(403);
    }
  });

  it("con Host local y sin sesión redirige a /acceso", async () => {
    const r = await proxy(peticion("/diseno"));
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/acceso");
  });
});

describe("configSupabase", () => {
  it("sin variables de entorno lanza un error en español que dice qué hacer", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => configSupabase()).toThrow(/npm run dev/);
  });

  it("no lee variables con el prefijo NEXT_PUBLIC_", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    expect(() => configSupabase()).toThrow();
  });

  it("con las dos variables devuelve la URL y la llave", () => {
    expect(configSupabase()).toEqual({ url: "http://127.0.0.1:54321", llavePublicable: "llave-sintetica-de-prueba" });
  });
});
