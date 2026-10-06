import { beforeEach, describe, expect, it, vi } from "vitest";

// Cliente falso: getClaims y la lectura de la fila de usuarios. La base real
// (con RLS) no devuelve fila para un usuario inactivo; aquí se simula igual.
const estado = vi.hoisted(() => ({
  claims: null as null | { sub: string },
  fila: null as null | Record<string, unknown>,
  errorConsulta: null as null | { message: string },
  filtro: [] as unknown[],
  seleccion: "",
}));

vi.mock("../../../src/servidor/supabase/servidor", () => ({
  crearClienteServidor: async () => ({
    auth: {
      getClaims: async () => ({ data: estado.claims ? { claims: estado.claims } : null, error: null }),
    },
    from: (tabla: string) => ({
      select: (columnas: string) => ({
        eq: (columna: string, valor: unknown) => {
          estado.filtro = [tabla, columna, valor];
          estado.seleccion = columnas;
          return {
            maybeSingle: async () => ({ data: estado.errorConsulta ? null : estado.fila, error: estado.errorConsulta }),
          };
        },
      }),
    }),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECCION:${destino}`);
  },
}));

const { usuarioActual, exigirUsuario, resolverSesion } = await import("../../../src/servidor/sesion");
const { rutaSinRefresco } = await import("../../../src/aplicacion/acceso/rutas");

const SUB = "00000000-0000-4000-8000-0000000000aa";
const FILA = {
  id: "00000000-0000-4000-8000-0000000000bb",
  nombre: "Ejecutiva Sintética Uno",
  rol: "EJECUTIVO",
  sucursal: { id: "00000000-0000-4000-8000-0000000000cc", nombre: "Sucursal Ficticia Norte" },
};

beforeEach(() => {
  estado.claims = null;
  estado.fila = null;
  estado.errorConsulta = null;
  estado.filtro = [];
});

describe("usuarioActual", () => {
  it("sin sesión devuelve null", async () => {
    expect(await usuarioActual()).toBeNull();
  });

  it("con sesión y usuario activo devuelve nombre, rol y sucursal", async () => {
    estado.claims = { sub: SUB };
    estado.fila = FILA;
    expect(await usuarioActual()).toEqual({
      id: FILA.id,
      authId: SUB,
      nombre: FILA.nombre,
      rol: "EJECUTIVO",
      sucursal: FILA.sucursal,
    });
    expect(estado.filtro).toEqual(["usuarios", "auth_id", SUB]);
  });

  it("la sucursal se pide por la llave usuarios_sucursal_id_fkey (hay otra relación con sucursales: creado_por)", async () => {
    estado.claims = { sub: SUB };
    estado.fila = FILA;
    await usuarioActual();
    expect(estado.seleccion).toMatch(/sucursales!usuarios_sucursal_id_fkey\(/);
  });

  it("un usuario inactivo (sin fila por RLS) se trata como sin sesión", async () => {
    estado.claims = { sub: SUB };
    estado.fila = null;
    expect(await usuarioActual()).toBeNull();
    expect(await resolverSesion()).toEqual({ tipo: "inactivo" });
  });

  it("si la consulta falla lanza un error en español, no lo confunde con inactivo", async () => {
    estado.claims = { sub: SUB };
    estado.errorConsulta = { message: "falla sintética" };
    await expect(resolverSesion()).rejects.toThrow(/No se pudo leer tu usuario/);
  });
});

describe("exigirUsuario", () => {
  it("con usuario activo lo devuelve", async () => {
    estado.claims = { sub: SUB };
    estado.fila = FILA;
    expect((await exigirUsuario()).nombre).toBe(FILA.nombre);
  });

  it("sin sesión redirige a /acceso", async () => {
    await expect(exigirUsuario()).rejects.toThrow("REDIRECCION:/acceso");
  });

  it("con usuario inactivo manda a cerrar la sesión, en una ruta fuera del proxy (sin bucle)", async () => {
    estado.claims = { sub: SUB };
    const error = await exigirUsuario().catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    const destino = (error as Error).message.replace("REDIRECCION:", "");
    expect(destino).toBe("/acceso/salir");
    expect(rutaSinRefresco(destino)).toBe(true);
  });
});
