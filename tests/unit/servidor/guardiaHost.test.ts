import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "../../../src/proxy";
import { MENSAJE_HOST_NO_AUTORIZADO, hostAutorizado, rechazoPorHost } from "../../../src/servidor/guardiaHost";

// El proxy, después del guardia de host, refresca la sesión con Supabase. Aquí
// un cliente falso sin sesión: lo que importa es que el Host permitido pase el guardia.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: null, error: null }) } }),
}));

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "llave-sintetica-de-prueba");
  vi.stubEnv("HOSTS_PERMITIDOS", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("rechazoPorHost sin HOSTS_PERMITIDOS (solo locales)", () => {
  it("con un Host público devuelve 403 con el mensaje en español", async () => {
    const r = rechazoPorHost("ejemplo.com");
    expect(r).not.toBeNull();
    expect(r!.status).toBe(403);
    expect(r!.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(r!.headers.get("cache-control")).toBe("no-store");
    expect(await r!.text()).toBe(MENSAJE_HOST_NO_AUTORIZADO);
  });

  it.each(["192.168.1.10:3000", "0.0.0.0:3000", "localhost.example.com", "localhost.evil.com", ""])("rechaza %j", (host) => {
    expect(rechazoPorHost(host)?.status).toBe(403);
  });

  it("sin encabezado Host también rechaza", () => {
    expect(rechazoPorHost(null)?.status).toBe(403);
  });

  it.each(["localhost:3000", "127.0.0.1:3100", "[::1]:3000", "localhost"])("deja pasar %j", (host) => {
    expect(rechazoPorHost(host)).toBeNull();
  });

  it("el mensaje es exactamente el acordado", () => {
    expect(MENSAJE_HOST_NO_AUTORIZADO).toBe("Esta dirección no está autorizada para esta aplicación.");
  });
});

describe("rechazoPorHost con HOSTS_PERMITIDOS", () => {
  beforeEach(() => {
    vi.stubEnv("HOSTS_PERMITIDOS", "crediflexi-prueba.vercel.app");
  });

  it("deja pasar el host de la lista, sin distinguir mayúsculas", () => {
    expect(rechazoPorHost("crediflexi-prueba.vercel.app")).toBeNull();
    expect(rechazoPorHost("Crediflexi-Prueba.Vercel.App")).toBeNull();
    expect(hostAutorizado("crediflexi-prueba.vercel.app")).toBe(true);
  });

  it.each(["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "otro.vercel.app", "x.crediflexi-prueba.vercel.app", "crediflexi-prueba.vercel.app.evil.com"])(
    "la lista reemplaza a los locales: rechaza %j",
    (host) => {
      expect(rechazoPorHost(host)?.status).toBe(403);
      expect(hostAutorizado(host)).toBe(false);
    },
  );

  it("con una lista mal formada falla cerrado: rechaza todo, también localhost", () => {
    vi.stubEnv("HOSTS_PERMITIDOS", "*.vercel.app");
    expect(rechazoPorHost("crediflexi-prueba.vercel.app")?.status).toBe(403);
    expect(rechazoPorHost("localhost:3000")?.status).toBe(403);
    expect(hostAutorizado("localhost:3000")).toBe(false);
  });

  it("vacía también es mal formada (no es lo mismo que no definirla)", () => {
    vi.stubEnv("HOSTS_PERMITIDOS", "");
    expect(rechazoPorHost("localhost:3000")?.status).toBe(403);
  });
});

describe("proxy", () => {
  it("con Host: ejemplo.com responde 403 en /cotizador", async () => {
    const r = await proxy(new NextRequest("http://ejemplo.com/cotizador", { headers: { host: "ejemplo.com" } }));
    expect(r.status).toBe(403);
    expect(await r.text()).toBe(MENSAJE_HOST_NO_AUTORIZADO);
  });

  it("también responde 403 a un POST (como el de una acción del servidor)", async () => {
    const r = await proxy(
      new NextRequest("http://ejemplo.com/cotizador", {
        method: "POST",
        headers: { host: "ejemplo.com", "next-action": "x" },
        body: "[]",
      }),
    );
    expect(r.status).toBe(403);
  });

  it("con localhost pasa el guardia y sigue a la revisión de sesión (sin sesión, a /acceso)", async () => {
    const r = await proxy(new NextRequest("http://localhost:3000/cotizador", { headers: { host: "localhost:3000" } }));
    expect(r.status).toBe(307);
    expect(new URL(r.headers.get("location")!).pathname).toBe("/acceso");
  });

  it("con HOSTS_PERMITIDOS, el host de la lista pasa y localhost da 403", async () => {
    vi.stubEnv("HOSTS_PERMITIDOS", "crediflexi-prueba.vercel.app");
    const permitido = await proxy(
      new NextRequest("https://crediflexi-prueba.vercel.app/cotizador", { headers: { host: "crediflexi-prueba.vercel.app" } }),
    );
    expect(permitido.status).toBe(307);
    const local = await proxy(new NextRequest("http://localhost:3000/cotizador", { headers: { host: "localhost:3000" } }));
    expect(local.status).toBe(403);
  });
});
