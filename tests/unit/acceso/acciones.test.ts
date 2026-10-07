import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  host: "127.0.0.1:3000" as string | null,
  errorAcceso: null as null | { code?: string; status?: number },
  claims: null as null | { sub: string },
  fila: null as null | Record<string, unknown>,
  errorConsulta: null as null | { message: string },
  llamadas: [] as string[],
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(estado.host === null ? {} : { host: estado.host }),
}));

vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECCION:${destino}`);
  },
}));

vi.mock("../../../src/servidor/supabase/servidor", () => ({
  crearClienteServidor: async () => ({
    auth: {
      signInWithPassword: async () => {
        estado.llamadas.push("signIn");
        if (estado.errorAcceso === null) estado.claims = { sub: "00000000-0000-4000-8000-0000000000aa" };
        return { data: {}, error: estado.errorAcceso };
      },
      getClaims: async () => {
        estado.llamadas.push("getClaims");
        return { data: estado.claims ? { claims: estado.claims } : null, error: null };
      },
      signOut: async () => {
        estado.llamadas.push("signOut");
        estado.claims = null;
        return { error: null };
      },
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: estado.errorConsulta ? null : estado.fila, error: estado.errorConsulta }) }) }),
    }),
  }),
}));

const { iniciarSesion, cerrarSesion } = await import("../../../src/app/acceso/acciones");
const { MENSAJES_ACCESO } = await import("../../../src/aplicacion/acceso/mensajes");

const FILA = { id: "u-1", nombre: "Ejecutivo Sintético", rol: "EJECUTIVO", sucursal: { id: "s-1", nombre: "Sucursal Ficticia" } };

function formulario(campos: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
}
const DATOS = { correo: "ejecutivo@ejemplo.test", contrasena: "contrasena-sintetica" };

beforeEach(() => {
  estado.host = "127.0.0.1:3000";
  estado.errorAcceso = null;
  estado.claims = null;
  estado.fila = FILA;
  estado.errorConsulta = null;
  estado.llamadas = [];
});

describe("iniciarSesion", () => {
  it("con Host no local no intenta entrar", async () => {
    estado.host = "ejemplo.com";
    const r = await iniciarSesion({ error: null }, formulario(DATOS));
    expect(r.error).toMatch(/localhost/);
    expect(estado.llamadas).not.toContain("signIn");
  });

  it("sin correo o contraseña pide llenarlos y no llama a Auth", async () => {
    const r = await iniciarSesion({ error: null }, formulario({ correo: " ", contrasena: "" }));
    expect(r.error).toMatch(/correo y tu contraseña/);
    expect(estado.llamadas).not.toContain("signIn");
  });

  it("con credenciales incorrectas da el mensaje genérico", async () => {
    estado.errorAcceso = { code: "invalid_credentials", status: 400 };
    const r = await iniciarSesion({ error: null }, formulario(DATOS));
    expect(r.error).toBe(MENSAJES_ACCESO.credenciales);
  });

  it("con demasiados intentos pide esperar", async () => {
    estado.errorAcceso = { code: "over_request_rate_limit", status: 429 };
    expect((await iniciarSesion({ error: null }, formulario(DATOS))).error).toBe(MENSAJES_ACCESO.demasiadosIntentos);
  });

  it("al entrar redirige al siguiente local y confirma la sesión con getClaims", async () => {
    await expect(iniciarSesion({ error: null }, formulario({ ...DATOS, siguiente: "/cotizador?plazo=12" }))).rejects.toThrow(
      "REDIRECCION:/cotizador?plazo=12",
    );
    expect(estado.llamadas).toEqual(["signIn", "getClaims"]);
  });

  it.each(["//evil.example", "https://evil.example", "/\\evil.example", "cotizador"])("con siguiente %j redirige al inicio", async (siguiente) => {
    await expect(iniciarSesion({ error: null }, formulario({ ...DATOS, siguiente }))).rejects.toThrow(/^REDIRECCION:\/$/);
  });

  it("si no se puede leer la fila del usuario, cierra la sesión y lo dice sin tirar la pantalla", async () => {
    estado.errorConsulta = { message: "falla sintética" };
    const r = await iniciarSesion({ error: null }, formulario(DATOS));
    expect(r.error).toMatch(/No se pudo leer tu usuario/);
    expect(estado.llamadas).toContain("signOut");
  });

  it("después de un error conserva el correo escrito, pero nunca la contraseña", async () => {
    estado.errorAcceso = { code: "invalid_credentials", status: 400 };
    const r = await iniciarSesion({ error: null }, formulario(DATOS));
    expect(r.correo).toBe(DATOS.correo);
    expect(JSON.stringify(r)).not.toContain(DATOS.contrasena);
  });

  it("un usuario inactivo no se queda con la sesión: se cierra y recibe el mensaje", async () => {
    estado.fila = null;
    const r = await iniciarSesion({ error: null }, formulario(DATOS));
    expect(r.error).toBe(MENSAJES_ACCESO.inactivo);
    expect(estado.llamadas).toContain("signOut");
    expect(estado.claims).toBeNull();
  });
});

describe("cerrarSesion", () => {
  it("cierra la sesión sin redirigir: el botón navega a /acceso con una carga completa", async () => {
    estado.claims = { sub: "00000000-0000-4000-8000-0000000000aa" };
    await expect(cerrarSesion()).resolves.toBeUndefined();
    expect(estado.llamadas).toEqual(["getClaims", "signOut"]);
  });

  it("sin sesión no llama a signOut ni falla", async () => {
    await expect(cerrarSesion()).resolves.toBeUndefined();
    expect(estado.llamadas).toEqual(["getClaims"]);
  });

  it("con Host no local no hace nada", async () => {
    estado.host = "ejemplo.com";
    estado.claims = { sub: "x" };
    await expect(cerrarSesion()).rejects.toThrow(/localhost/);
    expect(estado.llamadas).toEqual([]);
  });
});
