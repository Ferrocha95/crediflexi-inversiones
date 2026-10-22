import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Cliente falso de Supabase. Como el real (@supabase/ssr 0.12.7), llama a
// setAll con DEFAULT_COOKIE_OPTIONS (path "/", sameSite "lax", httpOnly false,
// maxAge de 400 días) al guardar y con maxAge 0 al borrar.
const escenario = vi.hoisted(() => ({ accion: "refresca" as "refresca" | "cierra" }));
const OPCIONES_DE_SSR = { path: "/", sameSite: "lax", httpOnly: false, maxAge: 400 * 24 * 60 * 60 } as const;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _llave: string, opciones: { cookies: { setAll: (c: unknown[], h: Record<string, string>) => void } }) => {
    const guardar = () =>
      opciones.cookies.setAll([{ name: "sb-proyecto-auth-token", value: "renovada", options: { ...OPCIONES_DE_SSR } }], {});
    const borrar = () =>
      opciones.cookies.setAll([{ name: "sb-proyecto-auth-token", value: "", options: { ...OPCIONES_DE_SSR, maxAge: 0 } }], {});
    return {
      auth: {
        getClaims: async () => {
          if (escenario.accion === "refresca") guardar();
          else borrar();
          return { data: { claims: { sub: "00000000-0000-4000-8000-000000000001" } }, error: null };
        },
        signOut: async () => {
          borrar();
          return { error: null };
        },
      },
    };
  },
}));

// next/headers falso para crearClienteServidor.
const almacen = vi.hoisted(() => ({
  guardadas: [] as { name: string; value: string; options: Record<string, unknown> }[],
  encabezados: new Map<string, string>(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: (name: string, value: string, options: Record<string, unknown>) => almacen.guardadas.push({ name, value, options }),
  }),
  headers: async () => ({ get: (k: string) => almacen.encabezados.get(k.toLowerCase()) ?? null }),
}));
vi.mock("server-only", () => ({}));

const { actualizarSesion, llegaPorHttps, opcionesDeCookie } = await import("../../../src/servidor/supabase/proxy");
const { crearClienteServidor } = await import("../../../src/servidor/supabase/servidor");

beforeEach(() => {
  escenario.accion = "refresca";
  almacen.guardadas = [];
  almacen.encabezados = new Map();
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "llave-sintetica-de-prueba");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const setCookie = (r: Response) => r.headers.get("set-cookie") ?? "";

describe("llegaPorHttps", () => {
  it.each([
    ["https:", null, true],
    ["http:", "https", true],
    ["http:", "https, http", true],
    ["http:", " HTTPS ", true],
    ["http:", "http", false],
    ["http:", null, false],
    ["http:", "", false],
    ["http:", "http, https", false],
    ["http:", "httpsx", false],
  ] as const)("protocolo %j y x-forwarded-proto %j → %s", (protocolo, reenviado, esperado) => {
    expect(llegaPorHttps(protocolo, reenviado)).toBe(esperado);
  });
});

describe("opcionesDeCookie", () => {
  it("fija httpOnly, sameSite lax y path /, y Secure solo con HTTPS", () => {
    expect(opcionesDeCookie({ ...OPCIONES_DE_SSR }, true)).toEqual({ ...OPCIONES_DE_SSR, httpOnly: true, sameSite: "lax", path: "/", secure: true });
    expect(opcionesDeCookie({ ...OPCIONES_DE_SSR }, false)).toEqual({ ...OPCIONES_DE_SSR, httpOnly: true, sameSite: "lax", path: "/", secure: false });
  });

  it("conserva maxAge (también 0, que es como se borra) y no deja que la librería las afloje", () => {
    const r = opcionesDeCookie({ maxAge: 0, httpOnly: false, sameSite: "none", path: "/otra", secure: false }, true);
    expect(r).toEqual({ maxAge: 0, httpOnly: true, sameSite: "lax", path: "/", secure: true });
  });

  it("sin opciones también devuelve las fijas", () => {
    expect(opcionesDeCookie(undefined, false)).toEqual({ httpOnly: true, sameSite: "lax", path: "/", secure: false });
  });
});

describe("proxy (actualizarSesion): opciones de las cookies", () => {
  it("con HTTPS las cookies salen Secure, HttpOnly, SameSite=Lax y Path=/", async () => {
    const r = await actualizarSesion(
      new NextRequest("https://crediflexi-prueba.vercel.app/cotizador", { headers: { host: "crediflexi-prueba.vercel.app" } }),
    );
    expect(r.status).toBe(200);
    const c = setCookie(r);
    expect(c).toMatch(/^sb-proyecto-auth-token=renovada;/);
    expect(c).toMatch(/; Secure/i);
    expect(c).toMatch(/; HttpOnly/i);
    expect(c).toMatch(/; SameSite=lax/i);
    expect(c).toMatch(/; Path=\//);
  });

  it("detrás del proxy de Vercel (x-forwarded-proto: https) también salen Secure", async () => {
    const r = await actualizarSesion(
      new NextRequest("http://crediflexi-prueba.vercel.app/cotizador", {
        headers: { host: "crediflexi-prueba.vercel.app", "x-forwarded-proto": "https" },
      }),
    );
    expect(setCookie(r)).toMatch(/; Secure/i);
  });

  it("con http://127.0.0.1 salen HttpOnly sin Secure: la sesión local sigue funcionando", async () => {
    const r = await actualizarSesion(new NextRequest("http://127.0.0.1:3000/cotizador", { headers: { host: "127.0.0.1:3000" } }));
    expect(r.status).toBe(200);
    const c = setCookie(r);
    expect(c).toMatch(/^sb-proyecto-auth-token=renovada;/);
    expect(c).toMatch(/; HttpOnly/i);
    expect(c).not.toMatch(/; Secure/i);
  });

  it('x-forwarded-proto "https, http" se trata como HTTPS: cuenta el PRIMER valor', async () => {
    const r = await actualizarSesion(
      new NextRequest("http://crediflexi-prueba.vercel.app/cotizador", {
        headers: { host: "crediflexi-prueba.vercel.app", "x-forwarded-proto": "https, http" },
      }),
    );
    expect(setCookie(r)).toMatch(/; Secure/i);
    expect(setCookie(r)).toMatch(/; HttpOnly/i);
  });

  it.each([
    ["desconocido", "ftp"],
    ["parecido", "httpsx"],
    ["vacío", ""],
    ["http primero", "http, https"],
    ["ausente", null],
  ])("x-forwarded-proto %s (%j) con URL http se trata como HTTP: sin Secure", async (_, reenviado) => {
    const encabezados: Record<string, string> = { host: "127.0.0.1:3000" };
    if (reenviado !== null) encabezados["x-forwarded-proto"] = reenviado;
    const r = await actualizarSesion(new NextRequest("http://127.0.0.1:3000/cotizador", { headers: encabezados }));
    expect(r.status).toBe(200);
    expect(setCookie(r)).toMatch(/; HttpOnly/i);
    expect(setCookie(r)).not.toMatch(/; Secure/i);
  });

  it("al borrar conserva Max-Age=0 con las mismas opciones", async () => {
    escenario.accion = "cierra";
    const r = await actualizarSesion(
      new NextRequest("https://crediflexi-prueba.vercel.app/cotizador", { headers: { host: "crediflexi-prueba.vercel.app" } }),
    );
    const c = setCookie(r);
    expect(c).toMatch(/^sb-proyecto-auth-token=;/);
    expect(c).toMatch(/; Max-Age=0/i);
    expect(c).toMatch(/; Path=\//);
    expect(c).toMatch(/; Secure/i);
  });
});

describe("crearClienteServidor: opciones de las cookies", () => {
  it("con x-forwarded-proto https guarda Secure y HttpOnly", async () => {
    almacen.encabezados.set("x-forwarded-proto", "https");
    const cliente = await crearClienteServidor();
    await cliente.auth.getClaims();
    expect(almacen.guardadas).toEqual([
      { name: "sb-proyecto-auth-token", value: "renovada", options: { ...OPCIONES_DE_SSR, httpOnly: true, sameSite: "lax", path: "/", secure: true } },
    ]);
  });

  it("con http (127.0.0.1) guarda HttpOnly sin Secure", async () => {
    almacen.encabezados.set("x-forwarded-proto", "http");
    const cliente = await crearClienteServidor();
    await cliente.auth.getClaims();
    expect(almacen.guardadas[0]?.options).toMatchObject({ httpOnly: true, secure: false, sameSite: "lax", path: "/" });
  });

  it('con x-forwarded-proto "https, http" guarda Secure (primer valor)', async () => {
    almacen.encabezados.set("x-forwarded-proto", "https, http");
    const cliente = await crearClienteServidor();
    await cliente.auth.getClaims();
    expect(almacen.guardadas[0]?.options).toMatchObject({ httpOnly: true, secure: true });
  });

  it.each([["desconocido", "ftp"], ["ausente", null]])("con x-forwarded-proto %s guarda sin Secure", async (_, reenviado) => {
    if (reenviado !== null) almacen.encabezados.set("x-forwarded-proto", reenviado);
    const cliente = await crearClienteServidor();
    await cliente.auth.getClaims();
    expect(almacen.guardadas[0]?.options).toMatchObject({ httpOnly: true, secure: false });
  });

  it("el cierre de sesión (signOut) borra las cookies: maxAge 0, mismo path", async () => {
    almacen.encabezados.set("x-forwarded-proto", "https");
    const cliente = await crearClienteServidor();
    await cliente.auth.signOut();
    expect(almacen.guardadas).toEqual([
      { name: "sb-proyecto-auth-token", value: "", options: { ...OPCIONES_DE_SSR, maxAge: 0, httpOnly: true, sameSite: "lax", path: "/", secure: true } },
    ]);
  });
});
