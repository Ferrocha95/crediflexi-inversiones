import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({
  sesion: { tipo: "sin_sesion" } as { tipo: string },
  cerradas: 0,
}));

vi.mock("../../../src/servidor/sesion", () => ({
  resolverSesion: async () => estado.sesion,
}));

vi.mock("../../../src/servidor/supabase/servidor", () => ({
  crearClienteServidor: async () => ({
    auth: {
      signOut: async () => {
        estado.cerradas += 1;
        return { error: null };
      },
    },
  }),
}));

const { GET } = await import("../../../src/app/acceso/salir/route");

const peticion = (host = "127.0.0.1:3000") =>
  new NextRequest("http://127.0.0.1:3000/acceso/salir", {
    headers: { host, cookie: "sb-local-auth-token=vieja; sb-local-auth-token.0=vieja; otra=queda" },
  });

// El Location es relativo: así el navegador se queda en el mismo host
// (127.0.0.1 o localhost), que tiene sus propias cookies.
function destinoDe(r: Response): URL {
  const location = r.headers.get("location")!;
  expect(location.startsWith("/")).toBe(true);
  expect(location.startsWith("//")).toBe(false);
  return new URL(location, "http://127.0.0.1:3000");
}

beforeEach(() => {
  estado.sesion = { tipo: "sin_sesion" };
  estado.cerradas = 0;
});

describe("/acceso/salir", () => {
  it("con usuario inactivo cierra la sesión, borra las cookies de Auth y muestra el aviso en /acceso", async () => {
    estado.sesion = { tipo: "inactivo" };
    const r = await GET(peticion());
    expect(estado.cerradas).toBe(1);
    expect(r.status).toBe(303);
    const destino = destinoDe(r);
    expect(destino.pathname).toBe("/acceso");
    expect(destino.searchParams.get("aviso")).toBe("inactivo");
    const borradas = r.headers.getSetCookie().filter((c) => /^sb-local-auth-token(\.0)?=;/.test(c));
    expect(borradas).toHaveLength(2);
    expect(r.headers.getSetCookie().some((c) => c.startsWith("otra="))).toBe(false);
    expect(r.headers.get("cache-control")).toMatch(/no-store/);
  });

  it("sin sesión no cierra nada y manda a /acceso sin aviso", async () => {
    const r = await GET(peticion());
    expect(estado.cerradas).toBe(0);
    expect(destinoDe(r).search).toBe("");
  });

  it("con usuario activo no cierra su sesión y lo regresa al inicio", async () => {
    estado.sesion = { tipo: "activo" };
    const r = await GET(peticion());
    expect(estado.cerradas).toBe(0);
    expect(destinoDe(r).pathname).toBe("/");
  });

  it("repite el guardia de host", async () => {
    estado.sesion = { tipo: "inactivo" };
    const r = await GET(peticion("ejemplo.com"));
    expect(r.status).toBe(403);
    expect(estado.cerradas).toBe(0);
  });
});
