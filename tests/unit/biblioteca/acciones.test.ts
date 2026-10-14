import { beforeEach, describe, expect, it, vi } from "vitest";

// Acciones de la Biblioteca: agregar un enlace y archivar. Cada una repite el
// guardia de host, exige usuario activo y rol Director o Gerente, y valida lo
// recibido antes de llegar a la base (que vuelve a revisarlo con RLS).

const encabezados = vi.hoisted(() => ({ host: "localhost:3000" as string | null }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(encabezados.host === null ? {} : { host: encabezados.host }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const sesion = vi.hoisted(() => ({
  usuario: null as null | { id: string; nombre: string; rol: string },
}));
vi.mock("../../../src/servidor/sesion", () => ({ usuarioActual: async () => sesion.usuario }));

const base = vi.hoisted(() => ({
  clientes: 0,
  filas: [] as Record<string, unknown>[],
  archivados: [] as string[],
  errorInsertar: null as { code?: string; message: string } | null,
  archivadoOk: true,
}));
vi.mock("../../../src/servidor/supabase/servidor", () => ({
  crearClienteServidor: async () => {
    base.clientes += 1;
    return {};
  },
}));
vi.mock("../../../src/servidor/biblioteca/consultas", () => ({
  insertarElemento: async (_c: unknown, fila: Record<string, unknown>) => {
    base.filas.push(fila);
    return base.errorInsertar === null ? { ok: true, id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" } : { ok: false, error: base.errorInsertar };
  },
  archivarElemento: async (_c: unknown, id: string) => {
    base.archivados.push(id);
    return base.archivadoOk;
  },
}));

import { agregarEnlace, archivar } from "../../../src/app/(app)/biblioteca/acciones";
import { MENSAJES_BIBLIOTECA } from "../../../src/aplicacion/biblioteca/reglas";
import { MENSAJE_SESION_EXPIRADA } from "../../../src/componentes/acceso/textos";
import { MENSAJE_HOST_NO_LOCAL } from "../../../src/servidor/guardiaHost";

const ID = "0b6c7d2e-1f3a-4b5c-8d9e-0a1b2c3d4e5f";
const GERENTE = { id: "g-1", nombre: "Gerente Sintético", rol: "GERENTE" };
const DIRECTOR = { id: "d-1", nombre: "Director Sintético", rol: "DIRECTOR_REGIONAL" };
const EJECUTIVO = { id: "e-1", nombre: "Ejecutiva Sintética", rol: "EJECUTIVO" };
const enlace = {
  nombre: "Video de bienvenida",
  descripcion: "Para el primer día.",
  categoria: "MULTIMEDIA",
  enlace: "https://videos.ejemplo.test/bienvenida",
};

beforeEach(() => {
  encabezados.host = "localhost:3000";
  sesion.usuario = GERENTE;
  base.clientes = 0;
  base.filas = [];
  base.archivados = [];
  base.errorInsertar = null;
  base.archivadoOk = true;
});

const llamadas = {
  agregarEnlace: () => agregarEnlace(enlace),
  archivar: () => archivar(ID),
};

describe.each(Object.entries(llamadas))("acción %s", (_nombre, llamar) => {
  it("con un Host que no es local responde el mensaje del guardia sin tocar la base", async () => {
    encabezados.host = "crediflexi.example";
    expect(await llamar()).toMatchObject({ ok: false, mensaje: MENSAJE_HOST_NO_LOCAL });
    expect(base.clientes).toBe(0);
  });

  it("sin usuario activo responde que la sesión expiró", async () => {
    sesion.usuario = null;
    expect(await llamar()).toMatchObject({ ok: false, mensaje: MENSAJE_SESION_EXPIRADA });
    expect(base.clientes).toBe(0);
  });

  it("un ejecutivo no puede: responde sin tocar la base", async () => {
    sesion.usuario = EJECUTIVO;
    expect(await llamar()).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.soloDirectorOGerente });
    expect(base.clientes).toBe(0);
  });

  it("el director sí puede", async () => {
    sesion.usuario = DIRECTOR;
    expect(await llamar()).toMatchObject({ ok: true });
  });
});

describe("agregarEnlace", () => {
  it("inserta un enlace con la URL normalizada, sin organización ni autor", async () => {
    const r = await agregarEnlace({ ...enlace, enlace: " https://Videos.Ejemplo.test/bienvenida " });
    expect(r).toEqual({ ok: true, id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
    expect(base.filas).toEqual([
      {
        categoria: "MULTIMEDIA",
        nombre: "Video de bienvenida",
        descripcion: "Para el primer día.",
        tipo: "ENLACE",
        enlace: "https://videos.ejemplo.test/bienvenida",
      },
    ]);
  });

  it.each([
    ["http", "http://videos.ejemplo.test/x"],
    ["con usuario y contraseña", "https://usuario:clave@videos.ejemplo.test/x"],
    ["javascript:", "javascript:alert(1)"],
  ])("rechaza un enlace %s sin tocar la base", async (_n, url) => {
    const r = await agregarEnlace({ ...enlace, enlace: url });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.enlace).toBeDefined();
    expect(base.clientes).toBe(0);
  });

  it("rechaza un dato sensible en el nombre sin tocar la base", async () => {
    const r = await agregarEnlace({ ...enlace, nombre: "Cuenta 012180001234567891" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.nombre).toMatch(/CLABE/);
    expect(base.clientes).toBe(0);
  });

  it("rechaza claves de más (organizacion_id, subido_por, ruta) sin tocar la base", async () => {
    for (const extra of [{ organizacion_id: ID }, { subido_por: ID }, { ruta: "x" }]) {
      const r = await agregarEnlace({ ...enlace, ...extra });
      expect(r.ok).toBe(false);
    }
    expect(base.clientes).toBe(0);
  });

  it("rechaza lo que no es un objeto", async () => {
    expect((await agregarEnlace("https://ejemplo.test")).ok).toBe(false);
    expect((await agregarEnlace(null)).ok).toBe(false);
  });

  it("traduce el rechazo de la base por permisos y por dato sensible", async () => {
    base.errorInsertar = { code: "42501", message: "new row violates row-level security policy" };
    expect(await agregarEnlace(enlace)).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.soloDirectorOGerente });
    base.errorInsertar = { code: "23514", message: 'violates check constraint "biblioteca_sin_datos_sensibles"' };
    expect(await agregarEnlace(enlace)).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.datoSensibleBase });
    base.errorInsertar = { code: "XX000", message: "otra" };
    expect(await agregarEnlace(enlace)).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.fallaGuardar });
  });
});

describe("archivar", () => {
  it("archiva por id", async () => {
    expect(await archivar(ID)).toEqual({ ok: true, id: ID });
    expect(base.archivados).toEqual([ID]);
  });

  it("un id que no es uuid se rechaza sin tocar la base", async () => {
    for (const id of ["x", "", 5, null]) {
      expect((await archivar(id)).ok).toBe(false);
    }
    expect(base.clientes).toBe(0);
  });

  it("si no se archivó ninguna fila (no existe, otra organización o ya archivado), lo dice", async () => {
    base.archivadoOk = false;
    expect(await archivar(ID)).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.noSeArchivo });
  });
});
