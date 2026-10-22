// Pruebas de RLS sobre public.biblioteca_carpetas y la columna
// public.biblioteca.carpeta_id.
//
// Subcarpetas de UN nivel dentro de cada sección (categoría). Leer: usuarios
// activos de la misma organización; lo archivado, solo Director regional y
// Gerente. Crear y archivar: solo Director regional y Gerente de la
// organización. Nadie borra. anon no tiene acceso. Una carpeta solo se archiva
// sin elementos activos (trigger). La llave compuesta (carpeta_id, categoria,
// organizacion_id) impide que un elemento apunte a una carpeta de otra sección
// o de otra organización; un elemento no entra, no se mueve ni se restaura en
// una carpeta archivada (trigger).
//
// Todo lo que crean las pruebas se borra en afterEach con el administrador:
// primero los elementos, luego las carpetas. Datos sintéticos con MARCA.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, inject, it } from "vitest";
import { comoAdmin, sufijo } from "./admin";
import {
  CHECK_VIOLADO,
  LLAVE_FORANEA_VIOLADA,
  PERMISO_DENEGADO,
  UNICO_VIOLADO,
  VALOR_INVALIDO,
  esperarSinFilasOPermisoDenegado,
} from "./ayudas";
import { comoAnonimo, comoUsuario } from "./clientes";
import { MARCA, type ClaveOrganizacion } from "./fixtures";
import { tomarFotoBase } from "./foto";

type Actor = "E1" | "E3" | "E4" | "E5" | "G1" | "G2" | "D1" | "D2";
const ACTORES: Actor[] = ["E1", "E3", "E4", "E5", "G1", "G2", "D1", "D2"];
type Categoria = "HERRAMIENTAS" | "MULTIMEDIA" | "EMPRESA" | "CAPACITACION";

const clientes = {} as Record<Actor, SupabaseClient>;
const admin = comoAdmin();
const elementosCreados: string[] = [];
const carpetasCreadas: string[] = [];

beforeAll(async () => {
  for (const actor of ACTORES) clientes[actor] = await comoUsuario(actor);
});

afterEach(async () => {
  const errores: string[] = [];
  // biblioteca.carpeta_id es "on delete restrict": los elementos van primero.
  if (elementosCreados.length > 0) {
    const { error } = await admin.from("biblioteca").delete().in("id", elementosCreados);
    if (error) errores.push(`borrar elementos: ${error.message}`);
  }
  if (carpetasCreadas.length > 0) {
    const { error } = await admin.from("biblioteca_carpetas").delete().in("id", carpetasCreadas);
    if (error) errores.push(`borrar carpetas: ${error.message}`);
  }
  elementosCreados.length = 0;
  carpetasCreadas.length = 0;
  if (errores.length > 0) throw new Error(`La limpieza de la prueba quedó incompleta (${errores.join("; ")}).`);
});

const org = (clave: ClaveOrganizacion) => inject("rls").idsOrganizaciones[clave];
const nombreCarpeta = () => `Carpeta ${sufijo()} ${MARCA}`;
const autorPorOmision = (organizacion: ClaveOrganizacion) => inject("rls").idsUsuarios[organizacion === "A" ? "G1" : "D2"];

/** Carpeta creada por el administrador (organización y autor explícitos). */
async function crearCarpeta(
  opciones: { organizacion?: ClaveOrganizacion; categoria?: Categoria; nombre?: string; archivada?: boolean } = {},
): Promise<string> {
  const organizacion = opciones.organizacion ?? "A";
  const { data, error } = await admin
    .from("biblioteca_carpetas")
    .insert({
      organizacion_id: org(organizacion),
      creado_por: autorPorOmision(organizacion),
      categoria: opciones.categoria ?? "CAPACITACION",
      nombre: opciones.nombre ?? nombreCarpeta(),
      archivado_en: opciones.archivada ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear una carpeta de prueba: ${error.message}`);
  carpetasCreadas.push(data.id as string);
  return data.id as string;
}

/** Enlace creado por el administrador, en una carpeta o "Sin carpeta". */
async function crearElemento(
  opciones: { organizacion?: ClaveOrganizacion; categoria?: Categoria; carpeta?: string | null; archivado?: boolean } = {},
): Promise<string> {
  const organizacion = opciones.organizacion ?? "A";
  const { data, error } = await admin
    .from("biblioteca")
    .insert({
      ...enlaceNuevo({ categoria: opciones.categoria ?? "CAPACITACION", carpeta_id: opciones.carpeta ?? null }),
      organizacion_id: org(organizacion),
      subido_por: autorPorOmision(organizacion),
      archivado_en: opciones.archivado ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear un elemento de prueba: ${error.message}`);
  elementosCreados.push(data.id as string);
  return data.id as string;
}

function enlaceNuevo(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    categoria: "CAPACITACION",
    nombre: `Enlace Sintético ${sufijo()} ${MARCA}`,
    descripcion: "",
    tipo: "ENLACE",
    enlace: "https://videos.ejemplo.test/capacitacion",
    ...extra,
  };
}

/** Busca con el administrador carpetas con ese nombre y las anota para borrarlas. */
async function carpetasConNombre(nombre: string) {
  const { data, error } = await admin.from("biblioteca_carpetas").select("*").eq("nombre", nombre);
  expect(error).toBeNull();
  for (const f of data ?? []) carpetasCreadas.push(f.id as string);
  return data ?? [];
}

async function elementosConNombre(nombre: string) {
  const { data, error } = await admin.from("biblioteca").select("*").eq("nombre", nombre);
  expect(error).toBeNull();
  for (const f of data ?? []) elementosCreados.push(f.id as string);
  return data ?? [];
}

async function carpetaDe(elemento: string): Promise<string | null> {
  const { data, error } = await admin.from("biblioteca").select("carpeta_id").eq("id", elemento).single();
  expect(error).toBeNull();
  return (data?.carpeta_id as string | null) ?? null;
}

async function archivadoEnDeCarpeta(carpeta: string): Promise<string | null> {
  const { data, error } = await admin.from("biblioteca_carpetas").select("archivado_en").eq("id", carpeta).single();
  expect(error).toBeNull();
  return (data?.archivado_en as string | null) ?? null;
}

async function confirmarDatosBase(): Promise<void> {
  const rls = inject("rls");
  expect(await tomarFotoBase(admin, rls)).toEqual(rls.fotoBase);
}

describe("RLS carpetas: lectura por organización", () => {
  it("D1, G1, G2, E1 y E3 (organización A) ven las carpetas activas de A y ninguna de B", async () => {
    const a = await crearCarpeta({ organizacion: "A" });
    const b = await crearCarpeta({ organizacion: "B" });
    for (const actor of ["D1", "G1", "G2", "E1", "E3"] as const) {
      const { data, error } = await clientes[actor].from("biblioteca_carpetas").select("id").in("id", [a, b]);
      expect(error, actor).toBeNull();
      expect(data, actor).toEqual([{ id: a }]);
    }
  });

  it("E1 y E3 no ven las carpetas archivadas; D1, G1 y G2 sí", async () => {
    const x = await crearCarpeta({ archivada: true });
    for (const actor of ["E1", "E3"] as const) {
      const { data } = await clientes[actor].from("biblioteca_carpetas").select("id").eq("id", x);
      expect(data, actor).toEqual([]);
    }
    for (const actor of ["D1", "G1", "G2"] as const) {
      const { data } = await clientes[actor].from("biblioteca_carpetas").select("id").eq("id", x);
      expect(data, actor).toEqual([{ id: x }]);
    }
  });

  it("la organización B (D2 y E4) no ve ninguna carpeta de A, ni filtrando por id", async () => {
    const a = await crearCarpeta({ organizacion: "A" });
    const ax = await crearCarpeta({ organizacion: "A", archivada: true });
    for (const actor of ["D2", "E4"] as const) {
      const { data, error } = await clientes[actor].from("biblioteca_carpetas").select("id").in("id", [a, ax]);
      expect(error, actor).toBeNull();
      expect(data, actor).toEqual([]);
    }
  });

  it("un usuario inactivo (E5) no ve ninguna carpeta", async () => {
    const a = await crearCarpeta({});
    const { data } = await clientes.E5.from("biblioteca_carpetas").select("id").eq("id", a);
    expect(data).toEqual([]);
  });

  it("anon no ve ninguna carpeta (o recibe permisos denegados)", async () => {
    await crearCarpeta({});
    esperarSinFilasOPermisoDenegado(await comoAnonimo().from("biblioteca_carpetas").select("id"));
  });
});

describe("RLS carpetas: crear solo Director regional y Gerente", () => {
  it("G1 crea una carpeta con RETURNING: la organización y quien la creó los pone la base", async () => {
    const { idsUsuarios } = inject("rls");
    const { data, error } = await clientes.G1
      .from("biblioteca_carpetas")
      .insert({ categoria: "CAPACITACION", nombre: nombreCarpeta() })
      .select("id, organizacion_id, creado_por, archivado_en")
      .single();
    if (data) carpetasCreadas.push(data.id as string);
    expect(error).toBeNull();
    expect(data?.organizacion_id).toBe(org("A"));
    expect(data?.creado_por).toBe(idsUsuarios.G1);
    expect(data?.archivado_en).toBeNull();
  });

  it("D1 crea una carpeta en su organización", async () => {
    const { data, error } = await clientes.D1
      .from("biblioteca_carpetas")
      .insert({ categoria: "HERRAMIENTAS", nombre: nombreCarpeta() })
      .select("id, organizacion_id, creado_por")
      .single();
    if (data) carpetasCreadas.push(data.id as string);
    expect(error).toBeNull();
    expect(data?.organizacion_id).toBe(org("A"));
    expect(data?.creado_por).toBe(inject("rls").idsUsuarios.D1);
  });

  for (const actor of ["E1", "E3", "E4", "E5"] as const) {
    it(`${actor} no puede crear una carpeta (42501) y no aparece ninguna fila`, async () => {
      const nombre = nombreCarpeta();
      const { data, error } = await clientes[actor].from("biblioteca_carpetas").insert({ categoria: "CAPACITACION", nombre });
      expect(data).toBeNull();
      expect(error?.code).toBe(PERMISO_DENEGADO);
      expect(await carpetasConNombre(nombre)).toEqual([]);
    });
  }

  it("anon no puede crear una carpeta (42501)", async () => {
    const nombre = nombreCarpeta();
    const { error } = await comoAnonimo().from("biblioteca_carpetas").insert({ categoria: "CAPACITACION", nombre });
    expect(error?.code).toBe(PERMISO_DENEGADO);
    expect(await carpetasConNombre(nombre)).toEqual([]);
  });

  const COLUMNAS_DE_LA_BASE: { nombre: string; extra: () => Record<string, unknown> }[] = [
    { nombre: "id", extra: () => ({ id: randomUUID() }) },
    { nombre: "organizacion_id (aunque sea la suya)", extra: () => ({ organizacion_id: org("A") }) },
    { nombre: "creado_por (aunque sea él)", extra: () => ({ creado_por: inject("rls").idsUsuarios.G1 }) },
    { nombre: "archivado_en", extra: () => ({ archivado_en: "2026-10-01T00:00:00Z" }) },
    { nombre: "creado_en", extra: () => ({ creado_en: "2020-01-01T00:00:00Z" }) },
  ];
  for (const caso of COLUMNAS_DE_LA_BASE) {
    it(`G1 no puede mandar ${caso.nombre} al crear una carpeta (42501)`, async () => {
      const nombre = nombreCarpeta();
      const { error } = await clientes.G1.from("biblioteca_carpetas").insert({ categoria: "CAPACITACION", nombre, ...caso.extra() });
      expect(error?.code).toBe(PERMISO_DENEGADO);
      expect(await carpetasConNombre(nombre)).toEqual([]);
    });
  }

  it("D2 (organización B) crea una carpeta en B y nadie de A la ve", async () => {
    const { data, error } = await clientes.D2
      .from("biblioteca_carpetas")
      .insert({ categoria: "CAPACITACION", nombre: nombreCarpeta() })
      .select("id, organizacion_id")
      .single();
    if (data) carpetasCreadas.push(data.id as string);
    expect(error).toBeNull();
    expect(data?.organizacion_id).toBe(org("B"));
    const visto = await clientes.D1.from("biblioteca_carpetas").select("id").eq("id", data!.id);
    expect(visto.data).toEqual([]);
  });
});

describe("RLS carpetas: nombre", () => {
  it("rechaza un nombre repetido en la misma sección, sin distinguir mayúsculas (23505)", async () => {
    const base = `Guías ${sufijo()} ${MARCA}`;
    await crearCarpeta({ nombre: base, categoria: "CAPACITACION" });
    for (const repetido of [base, base.toUpperCase(), base.toLowerCase()]) {
      const { error } = await clientes.G1.from("biblioteca_carpetas").insert({ categoria: "CAPACITACION", nombre: repetido });
      expect(error?.code, repetido).toBe(UNICO_VIOLADO);
    }
    expect(await carpetasConNombre(base.toUpperCase())).toEqual([]);
  });

  it("acepta el mismo nombre en otra sección y en otra organización", async () => {
    const base = `Guías ${sufijo()} ${MARCA}`;
    await crearCarpeta({ nombre: base, categoria: "CAPACITACION" });
    const otraSeccion = await clientes.G1.from("biblioteca_carpetas").insert({ categoria: "EMPRESA", nombre: base }).select("id").single();
    if (otraSeccion.data) carpetasCreadas.push(otraSeccion.data.id as string);
    expect(otraSeccion.error).toBeNull();
    const otraOrg = await clientes.D2.from("biblioteca_carpetas").insert({ categoria: "CAPACITACION", nombre: base }).select("id").single();
    if (otraOrg.data) carpetasCreadas.push(otraOrg.data.id as string);
    expect(otraOrg.error).toBeNull();
  });

  it("acepta el nombre de una carpeta archivada de la misma sección", async () => {
    const base = `Guías ${sufijo()} ${MARCA}`;
    await crearCarpeta({ nombre: base, archivada: true });
    const { data, error } = await clientes.G1.from("biblioteca_carpetas").insert({ categoria: "CAPACITACION", nombre: base }).select("id").single();
    if (data) carpetasCreadas.push(data.id as string);
    expect(error).toBeNull();
  });

  it("acepta un nombre de 80 caracteres", async () => {
    const nombre = `${MARCA} ${"N".repeat(80 - MARCA.length - 1)}`;
    const { data, error } = await clientes.G1.from("biblioteca_carpetas").insert({ categoria: "CAPACITACION", nombre }).select("id").single();
    if (data) carpetasCreadas.push(data.id as string);
    expect(error).toBeNull();
  });

  const RECHAZOS: { nombre: string; valor: () => string }[] = [
    { nombre: "un nombre vacío", valor: () => "" },
    { nombre: "un nombre de solo espacios", valor: () => "   " },
    { nombre: "un nombre de 81 caracteres", valor: () => `${MARCA} ${"N".repeat(81 - MARCA.length - 1)}` },
    { nombre: "un nombre con espacios al inicio", valor: () => ` ${nombreCarpeta()}` },
    { nombre: "un nombre con un tabulador", valor: () => `Carpeta\t${sufijo()} ${MARCA}` },
    { nombre: "un nombre con un salto de línea", valor: () => `Carpeta\n${sufijo()} ${MARCA}` },
    { nombre: "un nombre con un espacio de ancho cero", valor: () => `Carpeta\u200B${sufijo()} ${MARCA}` },
    { nombre: "un nombre con un cambio de dirección (U+202E)", valor: () => `Carpeta\u202E${sufijo()} ${MARCA}` },
    { nombre: "un nombre con BOM (U+FEFF)", valor: () => `Carpeta\uFEFF${sufijo()} ${MARCA}` },
    { nombre: "un nombre con relleno hangul (U+3164)", valor: () => `Carpeta\u3164${sufijo()} ${MARCA}` },
    { nombre: "una CLABE en el nombre", valor: () => `Cuenta 012180001234567891 ${MARCA}` },
    { nombre: "un RFC en el nombre", valor: () => `Contrato GODE561231GR8 ${MARCA}` },
  ];
  for (const caso of RECHAZOS) {
    it(`rechaza ${caso.nombre} (23514)`, async () => {
      const nombre = caso.valor();
      const { error } = await clientes.G1.from("biblioteca_carpetas").insert({ categoria: "CAPACITACION", nombre });
      expect(error?.code).toBe(CHECK_VIOLADO);
      expect(await carpetasConNombre(nombre)).toEqual([]);
    });
  }

  it("rechaza una categoría que no existe (22P02)", async () => {
    const { error } = await clientes.G1.from("biblioteca_carpetas").insert({ categoria: "OTRA", nombre: nombreCarpeta() });
    expect(error?.code).toBe(VALOR_INVALIDO);
  });
});

describe("RLS carpetas: archivar solo Director regional y Gerente, y solo vacías", () => {
  for (const actor of ["E1", "E3"] as const) {
    it(`${actor} no puede archivar una carpeta (0 filas) y sigue activa`, async () => {
      const c = await crearCarpeta({});
      const { data, error } = await clientes[actor]
        .from("biblioteca_carpetas")
        .update({ archivado_en: new Date().toISOString() })
        .eq("id", c)
        .select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
      expect(await archivadoEnDeCarpeta(c)).toBeNull();
    });
  }

  for (const actor of ["G1", "G2", "D1"] as const) {
    it(`${actor} archiva una carpeta vacía, la hora la pone el servidor y E1 deja de verla`, async () => {
      const c = await crearCarpeta({});
      const antes = Date.now();
      const { data, error } = await clientes[actor]
        .from("biblioteca_carpetas")
        .update({ archivado_en: "2000-01-01T00:00:00Z" })
        .eq("id", c)
        .select("archivado_en")
        .single();
      expect(error).toBeNull();
      expect(new Date(data!.archivado_en as string).getTime()).toBeGreaterThan(antes - 60_000);
      const e1 = await clientes.E1.from("biblioteca_carpetas").select("id").eq("id", c);
      expect(e1.data).toEqual([]);
    });
  }

  it("el trigger rechaza archivar una carpeta con un elemento activo (23514) y la carpeta sigue activa", async () => {
    const c = await crearCarpeta({});
    await crearElemento({ carpeta: c });
    for (const actor of ["G1", "D1"] as const) {
      const { error } = await clientes[actor].from("biblioteca_carpetas").update({ archivado_en: new Date().toISOString() }).eq("id", c);
      expect(error?.code, actor).toBe(CHECK_VIOLADO);
      expect(error?.message, actor).toContain("biblioteca_carpetas_sin_elementos_activos");
    }
    expect(await archivadoEnDeCarpeta(c)).toBeNull();
  });

  it("el trigger también rechaza al administrador: no es solo la política", async () => {
    const c = await crearCarpeta({});
    await crearElemento({ carpeta: c });
    const { error } = await admin.from("biblioteca_carpetas").update({ archivado_en: new Date().toISOString() }).eq("id", c);
    expect(error?.code).toBe(CHECK_VIOLADO);
    expect(await archivadoEnDeCarpeta(c)).toBeNull();
  });

  it("G1 archiva una carpeta que solo tiene elementos archivados", async () => {
    const c = await crearCarpeta({});
    await crearElemento({ carpeta: c, archivado: true });
    const { data, error } = await clientes.G1
      .from("biblioteca_carpetas")
      .update({ archivado_en: new Date().toISOString() })
      .eq("id", c)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: c }]);
  });

  it("un elemento activo de otra carpeta o sin carpeta no impide archivar", async () => {
    const c = await crearCarpeta({});
    const otra = await crearCarpeta({});
    await crearElemento({ carpeta: otra });
    await crearElemento({ carpeta: null });
    const { error } = await clientes.G1.from("biblioteca_carpetas").update({ archivado_en: new Date().toISOString() }).eq("id", c);
    expect(error).toBeNull();
    expect(await archivadoEnDeCarpeta(c)).not.toBeNull();
  });

  it("D2 (organización B) no puede archivar una carpeta de A (0 filas)", async () => {
    const c = await crearCarpeta({});
    const { data } = await clientes.D2
      .from("biblioteca_carpetas")
      .update({ archivado_en: new Date().toISOString() })
      .eq("id", c)
      .select("id");
    expect(data ?? []).toEqual([]);
    expect(await archivadoEnDeCarpeta(c)).toBeNull();
  });

  it("anon no puede archivar una carpeta (42501)", async () => {
    const c = await crearCarpeta({});
    const { error } = await comoAnonimo().from("biblioteca_carpetas").update({ archivado_en: new Date().toISOString() }).eq("id", c);
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });

  for (const columna of ["nombre", "categoria", "organizacion_id", "creado_por", "creado_en"] as const) {
    it(`G1 no puede cambiar ${columna} de una carpeta (42501)`, async () => {
      const c = await crearCarpeta({});
      const valores: Record<string, unknown> = {
        nombre: nombreCarpeta(),
        categoria: "HERRAMIENTAS",
        organizacion_id: org("A"),
        creado_por: inject("rls").idsUsuarios.G1,
        creado_en: "2020-01-01T00:00:00Z",
      };
      const { error } = await clientes.G1.from("biblioteca_carpetas").update({ [columna]: valores[columna] }).eq("id", c);
      expect(error?.code).toBe(PERMISO_DENEGADO);
    });
  }
});

describe("RLS carpetas: nadie borra (se archiva)", () => {
  for (const actor of ["E1", "G1", "D1", "D2"] as const) {
    it(`${actor} no puede borrar una carpeta (42501) y la fila sigue`, async () => {
      const c = await crearCarpeta({});
      const { error } = await clientes[actor].from("biblioteca_carpetas").delete().eq("id", c);
      expect(error?.code).toBe(PERMISO_DENEGADO);
      const fila = await admin.from("biblioteca_carpetas").select("id").eq("id", c);
      expect(fila.data).toEqual([{ id: c }]);
      await confirmarDatosBase();
    });
  }

  it("anon no puede borrar una carpeta (42501)", async () => {
    const c = await crearCarpeta({});
    const { error } = await comoAnonimo().from("biblioteca_carpetas").delete().eq("id", c);
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });
});

describe("RLS carpetas: elementos dentro de una carpeta (llave compuesta)", () => {
  it("G1 agrega un enlace en una carpeta de la misma sección y de su organización", async () => {
    const c = await crearCarpeta({ categoria: "MULTIMEDIA" });
    const { data, error } = await clientes.G1
      .from("biblioteca")
      .insert(enlaceNuevo({ categoria: "MULTIMEDIA", carpeta_id: c }))
      .select("id, carpeta_id")
      .single();
    if (data) elementosCreados.push(data.id as string);
    expect(error).toBeNull();
    expect(data?.carpeta_id).toBe(c);
  });

  it("E1 ve en qué carpeta está cada elemento", async () => {
    const c = await crearCarpeta({});
    const e = await crearElemento({ carpeta: c });
    const { data } = await clientes.E1.from("biblioteca").select("id, carpeta_id").eq("id", e);
    expect(data).toEqual([{ id: e, carpeta_id: c }]);
  });

  it("G1 no puede agregar un elemento en una carpeta de otra sección (23503)", async () => {
    const c = await crearCarpeta({ categoria: "EMPRESA" });
    const fila = enlaceNuevo({ categoria: "MULTIMEDIA", carpeta_id: c });
    const { error } = await clientes.G1.from("biblioteca").insert(fila);
    expect(error?.code).toBe(LLAVE_FORANEA_VIOLADA);
    expect(await elementosConNombre(fila.nombre as string)).toEqual([]);
  });

  it("G1 no puede agregar un elemento en una carpeta de otra organización (23503)", async () => {
    const c = await crearCarpeta({ organizacion: "B" });
    const fila = enlaceNuevo({ carpeta_id: c });
    const { error } = await clientes.G1.from("biblioteca").insert(fila);
    expect(error?.code).toBe(LLAVE_FORANEA_VIOLADA);
    expect(await elementosConNombre(fila.nombre as string)).toEqual([]);
  });

  it("G1 no puede agregar un elemento en una carpeta que no existe (23503)", async () => {
    const fila = enlaceNuevo({ carpeta_id: randomUUID() });
    const { error } = await clientes.G1.from("biblioteca").insert(fila);
    expect(error?.code).toBe(LLAVE_FORANEA_VIOLADA);
    expect(await elementosConNombre(fila.nombre as string)).toEqual([]);
  });

  it("la llave compuesta rechaza también al administrador: otra sección y otra organización (23503)", async () => {
    const otraSeccion = await crearCarpeta({ categoria: "EMPRESA" });
    const otraOrg = await crearCarpeta({ organizacion: "B" });
    for (const carpeta of [otraSeccion, otraOrg]) {
      const fila = enlaceNuevo({ carpeta_id: carpeta });
      const { error } = await admin
        .from("biblioteca")
        .insert({ ...fila, organizacion_id: org("A"), subido_por: inject("rls").idsUsuarios.G1 });
      expect(error?.code).toBe(LLAVE_FORANEA_VIOLADA);
      expect(await elementosConNombre(fila.nombre as string)).toEqual([]);
    }
  });

  it("G1 no puede agregar un elemento en una carpeta archivada (23514)", async () => {
    const c = await crearCarpeta({ archivada: true });
    const fila = enlaceNuevo({ carpeta_id: c });
    const { error } = await clientes.G1.from("biblioteca").insert(fila);
    expect(error?.code).toBe(CHECK_VIOLADO);
    expect(error?.message).toContain("biblioteca_carpeta_archivada");
    expect(await elementosConNombre(fila.nombre as string)).toEqual([]);
  });

  for (const actor of ["E1", "E3"] as const) {
    it(`${actor} no puede agregar un elemento en una carpeta (42501)`, async () => {
      const c = await crearCarpeta({});
      const fila = enlaceNuevo({ carpeta_id: c });
      const { error } = await clientes[actor].from("biblioteca").insert(fila);
      expect(error?.code).toBe(PERMISO_DENEGADO);
      expect(await elementosConNombre(fila.nombre as string)).toEqual([]);
    });
  }
});

describe("RLS carpetas: mover un elemento dentro de su sección", () => {
  for (const actor of ["G1", "D1"] as const) {
    it(`${actor} mueve un elemento a otra carpeta de la misma sección y lo devuelve a Sin carpeta`, async () => {
      const c1 = await crearCarpeta({});
      const c2 = await crearCarpeta({});
      const e = await crearElemento({ carpeta: c1 });
      const mover = await clientes[actor].from("biblioteca").update({ carpeta_id: c2 }).eq("id", e).select("carpeta_id").single();
      expect(mover.error).toBeNull();
      expect(mover.data?.carpeta_id).toBe(c2);
      const devolver = await clientes[actor].from("biblioteca").update({ carpeta_id: null }).eq("id", e).select("carpeta_id").single();
      expect(devolver.error).toBeNull();
      expect(devolver.data?.carpeta_id).toBeNull();
    });
  }

  it("mover no puede salir de la sección: G1 no lo mueve a una carpeta de otra sección (23503)", async () => {
    const c1 = await crearCarpeta({ categoria: "CAPACITACION" });
    const otra = await crearCarpeta({ categoria: "HERRAMIENTAS" });
    const e = await crearElemento({ carpeta: c1 });
    const { error } = await clientes.G1.from("biblioteca").update({ carpeta_id: otra }).eq("id", e);
    expect(error?.code).toBe(LLAVE_FORANEA_VIOLADA);
    expect(await carpetaDe(e)).toBe(c1);
  });

  it("mover no puede salir de la sección: G1 no cambia la categoría junto con la carpeta (42501)", async () => {
    const c1 = await crearCarpeta({ categoria: "CAPACITACION" });
    const otra = await crearCarpeta({ categoria: "HERRAMIENTAS" });
    const e = await crearElemento({ carpeta: c1 });
    const { error } = await clientes.G1.from("biblioteca").update({ carpeta_id: otra, categoria: "HERRAMIENTAS" }).eq("id", e);
    expect(error?.code).toBe(PERMISO_DENEGADO);
    expect(await carpetaDe(e)).toBe(c1);
  });

  it("G1 no mueve un elemento a una carpeta de otra organización (23503)", async () => {
    const e = await crearElemento({ carpeta: null });
    const otraOrg = await crearCarpeta({ organizacion: "B" });
    const { error } = await clientes.G1.from("biblioteca").update({ carpeta_id: otraOrg }).eq("id", e);
    expect(error?.code).toBe(LLAVE_FORANEA_VIOLADA);
    expect(await carpetaDe(e)).toBeNull();
  });

  it("G1 no mueve un elemento a una carpeta archivada (23514)", async () => {
    const e = await crearElemento({ carpeta: null });
    const archivada = await crearCarpeta({ archivada: true });
    const { error } = await clientes.G1.from("biblioteca").update({ carpeta_id: archivada }).eq("id", e);
    expect(error?.code).toBe(CHECK_VIOLADO);
    expect(error?.message).toContain("biblioteca_carpeta_archivada");
    expect(await carpetaDe(e)).toBeNull();
  });

  for (const actor of ["E1", "E3"] as const) {
    it(`${actor} no puede mover un elemento (0 filas) y sigue donde estaba`, async () => {
      const c1 = await crearCarpeta({});
      const c2 = await crearCarpeta({});
      const e = await crearElemento({ carpeta: c1 });
      const { data, error } = await clientes[actor].from("biblioteca").update({ carpeta_id: c2 }).eq("id", e).select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
      expect(await carpetaDe(e)).toBe(c1);
    });
  }

  it("D2 (organización B) no puede mover un elemento de A (0 filas)", async () => {
    const e = await crearElemento({ carpeta: null });
    const c = await crearCarpeta({});
    const { data } = await clientes.D2.from("biblioteca").update({ carpeta_id: c }).eq("id", e).select("id");
    expect(data ?? []).toEqual([]);
    expect(await carpetaDe(e)).toBeNull();
  });

  it("anon no puede mover un elemento (42501)", async () => {
    const e = await crearElemento({ carpeta: null });
    const c = await crearCarpeta({});
    const { error } = await comoAnonimo().from("biblioteca").update({ carpeta_id: c }).eq("id", e);
    expect(error?.code).toBe(PERMISO_DENEGADO);
    expect(await carpetaDe(e)).toBeNull();
  });
});

describe("RLS carpetas: restaurar un elemento", () => {
  it("G1 no puede restaurar un elemento cuya carpeta está archivada (23514) y sigue archivado", async () => {
    const c = await crearCarpeta({});
    const e = await crearElemento({ carpeta: c, archivado: true });
    const archivar = await admin.from("biblioteca_carpetas").update({ archivado_en: new Date().toISOString() }).eq("id", c);
    expect(archivar.error).toBeNull();
    const { error } = await clientes.G1.from("biblioteca").update({ archivado_en: null }).eq("id", e);
    expect(error?.code).toBe(CHECK_VIOLADO);
    expect(error?.message).toContain("biblioteca_restaurar_en_carpeta_archivada");
    const fila = await admin.from("biblioteca").select("archivado_en").eq("id", e).single();
    expect(fila.data?.archivado_en).not.toBeNull();
  });

  it("G1 restaura un elemento si su carpeta está activa o si está Sin carpeta", async () => {
    const c = await crearCarpeta({});
    for (const carpeta of [c, null]) {
      const e = await crearElemento({ carpeta, archivado: true });
      const { data, error } = await clientes.G1.from("biblioteca").update({ archivado_en: null }).eq("id", e).select("archivado_en").single();
      expect(error).toBeNull();
      expect(data?.archivado_en).toBeNull();
    }
  });

  it("G1 sí puede archivar un elemento que está en una carpeta", async () => {
    const c = await crearCarpeta({});
    const e = await crearElemento({ carpeta: c });
    const { data, error } = await clientes.G1
      .from("biblioteca")
      .update({ archivado_en: new Date().toISOString() })
      .eq("id", e)
      .select("archivado_en")
      .single();
    expect(error).toBeNull();
    expect(data?.archivado_en).not.toBeNull();
  });
});

// exigir_carpeta_activa() busca la carpeta solo en la sección y la
// organización del elemento: una carpeta ajena no revela si está archivada
// (decide la llave compuesta, 23503) ni queda bloqueada por el trigger.
describe("RLS carpetas: una carpeta de otra organización o sección no revela su estado", () => {
  it("(a) G1 con el uuid de una carpeta ARCHIVADA de la organización B recibe 23503 y no 23514, al agregar y al mover", async () => {
    const ajena = await crearCarpeta({ organizacion: "B", archivada: true });
    const fila = enlaceNuevo({ carpeta_id: ajena });
    const agregar = await clientes.G1.from("biblioteca").insert(fila);
    expect(agregar.error?.code).toBe(LLAVE_FORANEA_VIOLADA);
    expect(agregar.error?.message).not.toContain("archivada");
    expect(await elementosConNombre(fila.nombre as string)).toEqual([]);

    const e = await crearElemento({ carpeta: null });
    const mover = await clientes.G1.from("biblioteca").update({ carpeta_id: ajena }).eq("id", e);
    expect(mover.error?.code).toBe(LLAVE_FORANEA_VIOLADA);
    expect(mover.error?.message).not.toContain("archivada");
    expect(await carpetaDe(e)).toBeNull();
  });

  it("(b) G1 con el uuid de una carpeta ACTIVA de otra organización recibe 23503", async () => {
    const ajena = await crearCarpeta({ organizacion: "B" });
    const fila = enlaceNuevo({ carpeta_id: ajena });
    const { error } = await clientes.G1.from("biblioteca").insert(fila);
    expect(error?.code).toBe(LLAVE_FORANEA_VIOLADA);
    expect(await elementosConNombre(fila.nombre as string)).toEqual([]);
  });

  it("(c) G1 con una carpeta archivada de SU organización y sección sigue recibiendo 23514", async () => {
    const propia = await crearCarpeta({ organizacion: "A", archivada: true });
    const fila = enlaceNuevo({ carpeta_id: propia });
    const { error } = await clientes.G1.from("biblioteca").insert(fila);
    expect(error?.code).toBe(CHECK_VIOLADO);
    expect(error?.message).toContain("biblioteca_carpeta_archivada");
    expect(await elementosConNombre(fila.nombre as string)).toEqual([]);
  });

  it("(d) mover un elemento a una carpeta de otra sección da 23503, aunque esa carpeta esté archivada", async () => {
    const e = await crearElemento({ carpeta: null, categoria: "CAPACITACION" });
    for (const archivada of [false, true]) {
      const otra = await crearCarpeta({ categoria: "EMPRESA", archivada });
      const { error } = await clientes.G1.from("biblioteca").update({ carpeta_id: otra }).eq("id", e);
      expect(error?.code, `archivada: ${archivada}`).toBe(LLAVE_FORANEA_VIOLADA);
      expect(await carpetaDe(e)).toBeNull();
    }
  });
});
