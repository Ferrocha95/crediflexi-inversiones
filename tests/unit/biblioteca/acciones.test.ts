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
  /** Carpetas visibles por RLS: id → sección y si está archivada. */
  carpetas: {} as Record<string, { categoria: string; archivada: boolean }>,
  /** Elementos visibles por RLS: id → sección y si está archivado. */
  elementos: {} as Record<string, { categoria: string; archivado: boolean }>,
  activasPorSeccion: 0 as number | null,
  carpetasNuevas: [] as Record<string, unknown>[],
  errorCarpeta: null as { code?: string; message: string } | null,
  carpetasArchivadas: [] as string[],
  resultadoArchivarCarpeta: { ok: true } as { ok: true } | { ok: false; error: { code?: string; message: string } | null },
  movidos: [] as { id: string; carpeta: string | null }[],
  resultadoMover: { ok: true } as { ok: true } | { ok: false; error: { code?: string; message: string } | null },
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
  leerCarpeta: async (_c: unknown, id: string) => base.carpetas[id] ?? null,
  leerElementoParaMover: async (_c: unknown, id: string) => base.elementos[id] ?? null,
  contarCarpetasActivas: async () => base.activasPorSeccion,
  insertarCarpeta: async (_c: unknown, fila: Record<string, unknown>) => {
    base.carpetasNuevas.push(fila);
    return base.errorCarpeta === null ? { ok: true, id: CARPETA_NUEVA } : { ok: false, error: base.errorCarpeta };
  },
  archivarFilaCarpeta: async (_c: unknown, id: string) => {
    base.carpetasArchivadas.push(id);
    return base.resultadoArchivarCarpeta;
  },
  cambiarCarpeta: async (_c: unknown, id: string, carpeta: string | null) => {
    base.movidos.push({ id, carpeta });
    return base.resultadoMover;
  },
}));

const CARPETA_NUEVA = "cccccccc-0000-4000-8000-000000000000";

import { agregarEnlace, archivar, archivarCarpeta, crearCarpeta, moverElemento } from "../../../src/app/(app)/biblioteca/acciones";
import { MENSAJES_BIBLIOTECA } from "../../../src/aplicacion/biblioteca/reglas";
import { MENSAJE_SESION_EXPIRADA } from "../../../src/componentes/acceso/textos";
import { MENSAJE_HOST_NO_AUTORIZADO } from "../../../src/servidor/guardiaHost";

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
  base.carpetas = {
    [CARPETA_MULTIMEDIA]: { categoria: "MULTIMEDIA", archivada: false },
    [CARPETA_MULTIMEDIA_2]: { categoria: "MULTIMEDIA", archivada: false },
    [CARPETA_EMPRESA]: { categoria: "EMPRESA", archivada: false },
    [CARPETA_ARCHIVADA]: { categoria: "MULTIMEDIA", archivada: true },
  };
  base.elementos = { [ID]: { categoria: "MULTIMEDIA", archivado: false }, [ID_ARCHIVADO]: { categoria: "MULTIMEDIA", archivado: true } };
  base.activasPorSeccion = 0;
  base.carpetasNuevas = [];
  base.errorCarpeta = null;
  base.carpetasArchivadas = [];
  base.resultadoArchivarCarpeta = { ok: true };
  base.movidos = [];
  base.resultadoMover = { ok: true };
});

const CARPETA_MULTIMEDIA = "1a1a1a1a-0000-4000-8000-000000000001";
const CARPETA_MULTIMEDIA_2 = "2b2b2b2b-0000-4000-8000-000000000002";
const CARPETA_EMPRESA = "3c3c3c3c-0000-4000-8000-000000000003";
const CARPETA_ARCHIVADA = "4d4d4d4d-0000-4000-8000-000000000004";
const ID_ARCHIVADO = "5e5e5e5e-0000-4000-8000-000000000005";

const llamadas = {
  agregarEnlace: () => agregarEnlace(enlace),
  archivar: () => archivar(ID),
  crearCarpeta: () => crearCarpeta({ categoria: "MULTIMEDIA", nombre: "Videos de bienvenida" }),
  archivarCarpeta: () => archivarCarpeta(CARPETA_MULTIMEDIA),
  moverElemento: () => moverElemento({ id: ID, carpeta_id: CARPETA_MULTIMEDIA }),
};

describe.each(Object.entries(llamadas))("acción %s", (_nombre, llamar) => {
  it("con un Host que no es local responde el mensaje del guardia sin tocar la base", async () => {
    encabezados.host = "crediflexi.example";
    expect(await llamar()).toMatchObject({ ok: false, mensaje: MENSAJE_HOST_NO_AUTORIZADO });
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

describe("agregarEnlace en una carpeta", () => {
  it("sin carpeta_id, o con null, el enlace queda Sin carpeta", async () => {
    await agregarEnlace(enlace);
    await agregarEnlace({ ...enlace, carpeta_id: null });
    expect(base.filas.map((f) => f.carpeta_id ?? null)).toEqual([null, null]);
  });

  it("con una carpeta activa de la misma sección, la manda en carpeta_id", async () => {
    expect(await agregarEnlace({ ...enlace, carpeta_id: CARPETA_MULTIMEDIA })).toMatchObject({ ok: true });
    expect(base.filas[0]).toMatchObject({ carpeta_id: CARPETA_MULTIMEDIA, categoria: "MULTIMEDIA" });
  });

  it.each([
    ["que no es uuid", "carpeta"],
    ["de otra sección", CARPETA_EMPRESA],
    ["que no existe o no es visible", "9f9f9f9f-0000-4000-8000-00000000009f"],
  ])("rechaza una carpeta %s sin insertar", async (_n, carpeta) => {
    const r = await agregarEnlace({ ...enlace, carpeta_id: carpeta });
    expect(r).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaInvalida });
    if (!r.ok) expect(r.errores.carpeta).toBe(MENSAJES_BIBLIOTECA.carpetaInvalida);
    expect(base.filas).toEqual([]);
  });

  it("rechaza una carpeta archivada sin insertar", async () => {
    expect(await agregarEnlace({ ...enlace, carpeta_id: CARPETA_ARCHIVADA })).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaArchivada });
    expect(base.filas).toEqual([]);
  });
});

describe("crearCarpeta", () => {
  it("inserta solo categoría y nombre limpio; la organización y quien la creó los pone la base", async () => {
    expect(await crearCarpeta({ categoria: "MULTIMEDIA", nombre: "  Videos   de bienvenida " })).toEqual({ ok: true, id: CARPETA_NUEVA });
    expect(base.carpetasNuevas).toEqual([{ categoria: "MULTIMEDIA", nombre: "Videos de bienvenida" }]);
  });

  it("rechaza claves de más (organizacion_id, creado_por, archivado_en, id) sin tocar la base", async () => {
    for (const extra of [{ organizacion_id: ID }, { creado_por: ID }, { archivado_en: null }, { id: ID }]) {
      const r = await crearCarpeta({ categoria: "MULTIMEDIA", nombre: "Videos", ...extra });
      expect(r).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.formaInvalida });
    }
    expect(base.clientes).toBe(0);
  });

  it("rechaza lo que no es un objeto", async () => {
    for (const entrada of [null, "Videos", ["Videos"]]) expect((await crearCarpeta(entrada)).ok).toBe(false);
    expect(base.clientes).toBe(0);
  });

  it("rechaza una sección inválida, un nombre vacío, uno de 81 caracteres o con un dato sensible, sin tocar la base", async () => {
    expect(await crearCarpeta({ categoria: "OTRA", nombre: "Videos" })).toMatchObject({ ok: false, errores: { categoria: MENSAJES_BIBLIOTECA.categoriaInvalida } });
    expect(await crearCarpeta({ categoria: "MULTIMEDIA", nombre: "  " })).toMatchObject({ ok: false, errores: { nombre: MENSAJES_BIBLIOTECA.carpetaNombreVacio } });
    expect(await crearCarpeta({ categoria: "MULTIMEDIA", nombre: "N".repeat(81) })).toMatchObject({ ok: false, errores: { nombre: MENSAJES_BIBLIOTECA.carpetaNombreLargo } });
    const sensible = await crearCarpeta({ categoria: "MULTIMEDIA", nombre: "Cuenta 012180001234567891" });
    expect(sensible.ok).toBe(false);
    expect(base.clientes).toBe(0);
  });

  it("con 30 carpetas activas en la sección rechaza la 31 sin insertar; con 29 la acepta", async () => {
    base.activasPorSeccion = 30;
    expect(await crearCarpeta({ categoria: "MULTIMEDIA", nombre: "Otra" })).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaTope });
    expect(base.carpetasNuevas).toEqual([]);
    base.activasPorSeccion = 29;
    expect(await crearCarpeta({ categoria: "MULTIMEDIA", nombre: "Otra" })).toMatchObject({ ok: true });
  });

  it("si no se pudo contar las carpetas, no inserta", async () => {
    base.activasPorSeccion = null;
    expect(await crearCarpeta({ categoria: "MULTIMEDIA", nombre: "Otra" })).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.fallaGuardar });
    expect(base.carpetasNuevas).toEqual([]);
  });

  it("traduce el nombre repetido y el rechazo por permisos de la base", async () => {
    base.errorCarpeta = { code: "23505", message: 'duplicate key value violates unique constraint "biblioteca_carpetas_nombre_unico_activas"' };
    expect(await crearCarpeta({ categoria: "MULTIMEDIA", nombre: "Videos" })).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaRepetida });
    base.errorCarpeta = { code: "42501", message: "new row violates row-level security policy" };
    expect(await crearCarpeta({ categoria: "MULTIMEDIA", nombre: "Videos" })).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.soloDirectorOGerente });
  });
});

describe("archivarCarpeta", () => {
  it("archiva por id", async () => {
    expect(await archivarCarpeta(CARPETA_MULTIMEDIA)).toEqual({ ok: true, id: CARPETA_MULTIMEDIA });
    expect(base.carpetasArchivadas).toEqual([CARPETA_MULTIMEDIA]);
  });

  it("un id que no es uuid se rechaza sin tocar la base", async () => {
    for (const id of ["x", "", 5, null, { id: CARPETA_MULTIMEDIA }]) expect((await archivarCarpeta(id)).ok).toBe(false);
    expect(base.clientes).toBe(0);
  });

  it("si la carpeta tiene elementos activos, lo dice con el mensaje de la base traducido", async () => {
    base.resultadoArchivarCarpeta = { ok: false, error: { code: "23514", message: "la carpeta tiene elementos activos (biblioteca_carpetas_sin_elementos_activos)" } };
    expect(await archivarCarpeta(CARPETA_MULTIMEDIA)).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaConElementos });
  });

  it("si no se archivó ninguna fila, lo dice", async () => {
    base.resultadoArchivarCarpeta = { ok: false, error: null };
    expect(await archivarCarpeta(CARPETA_MULTIMEDIA)).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.noSeArchivoCarpeta });
  });
});

describe("moverElemento", () => {
  it("mueve a una carpeta activa de la misma sección y devuelve a Sin carpeta", async () => {
    expect(await moverElemento({ id: ID, carpeta_id: CARPETA_MULTIMEDIA_2 })).toEqual({ ok: true, id: ID });
    expect(await moverElemento({ id: ID, carpeta_id: null })).toEqual({ ok: true, id: ID });
    expect(base.movidos).toEqual([
      { id: ID, carpeta: CARPETA_MULTIMEDIA_2 },
      { id: ID, carpeta: null },
    ]);
  });

  it("no puede salir de la sección: una carpeta de otra sección se rechaza sin tocar el elemento", async () => {
    expect(await moverElemento({ id: ID, carpeta_id: CARPETA_EMPRESA })).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaInvalida });
    expect(base.movidos).toEqual([]);
  });

  it("una carpeta archivada se rechaza sin tocar el elemento", async () => {
    expect(await moverElemento({ id: ID, carpeta_id: CARPETA_ARCHIVADA })).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaArchivada });
    expect(base.movidos).toEqual([]);
  });

  it("un elemento que no existe, no es visible o está archivado no se mueve", async () => {
    expect(await moverElemento({ id: "9f9f9f9f-0000-4000-8000-00000000009f", carpeta_id: null })).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.noEncontrado });
    expect(await moverElemento({ id: ID_ARCHIVADO, carpeta_id: null })).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.noSeMovio });
    expect(base.movidos).toEqual([]);
  });

  it("rechaza claves de más o de menos, y ids inválidos, sin tocar la base", async () => {
    for (const entrada of [
      { id: ID, carpeta_id: null, categoria: "EMPRESA" },
      { id: ID, carpeta_id: null, organizacion_id: ID },
      { id: ID },
      { carpeta_id: null },
      { id: "x", carpeta_id: null },
      { id: ID, carpeta_id: "x" },
      null,
      ID,
    ]) {
      expect((await moverElemento(entrada)).ok).toBe(false);
    }
    expect(base.clientes).toBe(0);
  });

  it("traduce el rechazo de la llave compuesta y el de no mover ninguna fila", async () => {
    base.resultadoMover = {
      ok: false,
      error: { code: "23503", message: 'violates foreign key constraint "biblioteca_carpeta_misma_seccion_y_organizacion"' },
    };
    expect(await moverElemento({ id: ID, carpeta_id: CARPETA_MULTIMEDIA })).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.carpetaInvalida });
    base.resultadoMover = { ok: false, error: null };
    expect(await moverElemento({ id: ID, carpeta_id: CARPETA_MULTIMEDIA })).toMatchObject({ ok: false, mensaje: MENSAJES_BIBLIOTECA.noSeMovio });
  });
});
