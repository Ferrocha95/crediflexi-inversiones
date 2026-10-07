import { beforeEach, describe, expect, it, vi } from "vitest";

// La ruta del PDF con usuario activo, sin usuario y con un usuario inactivo
// cuya sesión sigue vigente (RLS no le devuelve fila: usuarioActual() da null).
const estado = vi.hoisted(() => ({ usuario: null as null | { nombre: string }, llamadasPdf: 0, llamadasUsuario: 0 }));

vi.mock("../../../src/servidor/sesion", () => ({
  usuarioActual: async () => {
    estado.llamadasUsuario += 1;
    return estado.usuario;
  },
}));

vi.mock("../../../src/servidor/pdf/manejador", () => ({
  manejarPdf: async () => {
    estado.llamadasPdf += 1;
    return new Response("%PDF-sintetico", { status: 200, headers: { "content-type": "application/pdf" } });
  },
}));

const { POST } = await import("../../../src/app/(app)/cotizador/pdf/route");
const { MENSAJE_SESION_EXPIRADA } = await import("../../../src/componentes/acceso/textos");

const peticion = (host = "127.0.0.1:3000") =>
  new Request("http://127.0.0.1:3000/cotizador/pdf", {
    method: "POST",
    headers: { host, "content-type": "application/json" },
    body: "{}",
  });

beforeEach(() => {
  estado.usuario = null;
  estado.llamadasPdf = 0;
  estado.llamadasUsuario = 0;
});

describe("POST /cotizador/pdf comprueba al usuario", () => {
  it("un usuario inactivo con sesión vigente recibe 401 en JSON con el mensaje en español, sin PDF", async () => {
    const r = await POST(peticion());
    expect(r.status).toBe(401);
    expect(r.headers.get("content-type")).toMatch(/^application\/json/);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ error: MENSAJE_SESION_EXPIRADA });
    expect(estado.llamadasPdf).toBe(0);
  });

  it("con usuario activo genera el PDF", async () => {
    estado.usuario = { nombre: "Ejecutivo Sintético" };
    const r = await POST(peticion());
    expect(r.status).toBe(200);
    expect(estado.llamadasPdf).toBe(1);
  });

  it("con Host no local responde 403 antes de leer la sesión", async () => {
    estado.usuario = { nombre: "Ejecutivo Sintético" };
    const r = await POST(peticion("ejemplo.com"));
    expect(r.status).toBe(403);
    expect(estado.llamadasUsuario).toBe(0);
    expect(estado.llamadasPdf).toBe(0);
  });

  it("el mensaje es el acordado", () => {
    expect(MENSAJE_SESION_EXPIRADA).toBe("Tu sesión expiró; vuelve a iniciar sesión.");
  });
});
