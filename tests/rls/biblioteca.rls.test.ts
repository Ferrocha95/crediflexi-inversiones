// Pruebas de RLS sobre public.biblioteca y el bucket privado "biblioteca".
//
// Leer: usuarios activos de la misma organización; lo archivado, solo
// Director regional y Gerente. Insertar y archivar: solo Director regional y
// Gerente, a su nombre y en su organización. Nadie borra. anon no tiene
// acceso. El bucket repite las mismas reglas: ruta con el prefijo de la
// organización; leer, la organización (un ejecutivo, solo si la fila está
// visible para él); subir, Director y Gerente; sin actualizar ni borrar.
//
// Todo lo que crean las pruebas se borra en afterEach con el administrador.
// Datos sintéticos: nombres con MARCA y bytes de relleno.

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, describe, expect, inject, it } from "vitest";
import { comoAdmin, sufijo } from "./admin";
import { CHECK_VIOLADO, PERMISO_DENEGADO, esperarSinFilasOPermisoDenegado } from "./ayudas";
import { comoAnonimo, comoUsuario } from "./clientes";
import { MARCA, type ClaveOrganizacion } from "./fixtures";
import { tomarFotoBase } from "./foto";

type Actor = "E1" | "E3" | "E4" | "E5" | "G1" | "G2" | "D1" | "D2";
const ACTORES: Actor[] = ["E1", "E3", "E4", "E5", "G1", "G2", "D1", "D2"];

const BUCKET = "biblioteca";
const TOPE_BYTES = 26_214_400;
const PDF = "application/pdf";
const TIPOS_PERMITIDOS = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

const clientes = {} as Record<Actor, SupabaseClient>;
const admin = comoAdmin();
const filasCreadas: string[] = [];
const objetosCreados: string[] = [];

beforeAll(async () => {
  for (const actor of ACTORES) clientes[actor] = await comoUsuario(actor);
});

afterEach(async () => {
  const errores: string[] = [];
  if (filasCreadas.length > 0) {
    const { error } = await admin.from("biblioteca").delete().in("id", filasCreadas);
    if (error) errores.push(`borrar filas: ${error.message}`);
  }
  if (objetosCreados.length > 0) {
    const { error } = await admin.storage.from(BUCKET).remove(objetosCreados);
    if (error) errores.push(`borrar objetos: ${error.message}`);
  }
  filasCreadas.length = 0;
  objetosCreados.length = 0;
  if (errores.length > 0) throw new Error(`La limpieza de la prueba quedó incompleta (${errores.join("; ")}).`);
});

const org = (clave: ClaveOrganizacion) => inject("rls").idsOrganizaciones[clave];
const rutaNueva = (clave: ClaveOrganizacion, ext = "pdf") => `${org(clave)}/${randomUUID()}.${ext}`;
const nombreNuevo = () => `Documento Sintético ${sufijo()} ${MARCA}`;
const bytesPdf = (largo = 64) => {
  const b = new Uint8Array(largo);
  b.set(new TextEncoder().encode("%PDF-1.7\n"));
  return b;
};

/** Fila válida para insertar como cliente, sin columnas que fija la base. */
function archivoNuevo(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    categoria: "CAPACITACION",
    nombre: nombreNuevo(),
    descripcion: "Guía sintética de prueba.",
    tipo: "ARCHIVO",
    ruta: rutaNueva("A"),
    tipo_mime: PDF,
    tamano_bytes: 64,
    ...extra,
  };
}

function enlaceNuevo(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    categoria: "MULTIMEDIA",
    nombre: nombreNuevo(),
    descripcion: "Video sintético de prueba.",
    tipo: "ENLACE",
    enlace: "https://videos.ejemplo.test/capacitacion",
    ...extra,
  };
}

/** Fila creada por el administrador (organización y autor explícitos). */
async function crearFila(opciones: {
  organizacion?: ClaveOrganizacion;
  autor?: "G1" | "D1" | "D2";
  archivado?: boolean;
  ruta?: string;
}): Promise<{ id: string; ruta: string }> {
  const organizacion = opciones.organizacion ?? "A";
  const ruta = opciones.ruta ?? rutaNueva(organizacion);
  const { data, error } = await admin
    .from("biblioteca")
    .insert({
      ...archivoNuevo({ ruta }),
      organizacion_id: org(organizacion),
      subido_por: inject("rls").idsUsuarios[opciones.autor ?? (organizacion === "A" ? "G1" : "D2")],
      archivado_en: opciones.archivado ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear una fila de prueba: ${error.message}`);
  filasCreadas.push(data.id as string);
  return { id: data.id as string, ruta };
}

/** Objeto subido por el administrador en el bucket. */
async function crearObjeto(ruta: string): Promise<void> {
  const { error } = await admin.storage.from(BUCKET).upload(ruta, bytesPdf(), { contentType: PDF });
  if (error) throw new Error(`No se pudo subir un objeto de prueba: ${error.message}`);
  objetosCreados.push(ruta);
}

async function existeObjeto(ruta: string): Promise<boolean> {
  const { data, error } = await admin.storage.from(BUCKET).download(ruta);
  return error === null && data !== null;
}

/** Busca con el administrador filas con ese nombre y las anota para borrarlas. */
async function filasConNombre(nombre: string) {
  const { data, error } = await admin.from("biblioteca").select("*").eq("nombre", nombre);
  expect(error).toBeNull();
  for (const f of data ?? []) filasCreadas.push(f.id as string);
  return data ?? [];
}

async function confirmarDatosBase(): Promise<void> {
  const rls = inject("rls");
  expect(await tomarFotoBase(admin, rls)).toEqual(rls.fotoBase);
}

describe("RLS biblioteca: lectura por organización", () => {
  it("D1, G1, G2, E1 y E3 (organización A) ven los activos de A y ninguno de B", async () => {
    const a = await crearFila({ organizacion: "A" });
    const b = await crearFila({ organizacion: "B" });
    for (const actor of ["D1", "G1", "G2", "E1", "E3"] as const) {
      const { data, error } = await clientes[actor].from("biblioteca").select("id").in("id", [a.id, b.id]);
      expect(error, actor).toBeNull();
      expect(data, actor).toEqual([{ id: a.id }]);
    }
  });

  it("E1 y E3 no ven los archivados; D1, G1 y G2 sí", async () => {
    const x = await crearFila({ archivado: true });
    for (const actor of ["E1", "E3"] as const) {
      const { data } = await clientes[actor].from("biblioteca").select("id").eq("id", x.id);
      expect(data, actor).toEqual([]);
    }
    for (const actor of ["D1", "G1", "G2"] as const) {
      const { data } = await clientes[actor].from("biblioteca").select("id").eq("id", x.id);
      expect(data, actor).toEqual([{ id: x.id }]);
    }
  });

  it("la organización B (D2 y E4) no ve nada de A, ni filtrando por id", async () => {
    const a = await crearFila({ organizacion: "A" });
    const ax = await crearFila({ organizacion: "A", archivado: true });
    for (const actor of ["D2", "E4"] as const) {
      const { data, error } = await clientes[actor].from("biblioteca").select("id").in("id", [a.id, ax.id]);
      expect(error, actor).toBeNull();
      expect(data, actor).toEqual([]);
    }
  });

  it("un usuario inactivo (E5) no ve nada", async () => {
    const a = await crearFila({ organizacion: "A" });
    const { data } = await clientes.E5.from("biblioteca").select("id").eq("id", a.id);
    expect(data).toEqual([]);
  });

  it("anon no ve nada (o recibe permisos denegados)", async () => {
    await crearFila({ organizacion: "A" });
    esperarSinFilasOPermisoDenegado(await comoAnonimo().from("biblioteca").select("id"));
  });
});

describe("RLS biblioteca: insertar solo Director regional y Gerente", () => {
  it("G1 inserta un enlace con RETURNING: la organización y quien subió los pone la base", async () => {
    const { idsUsuarios } = inject("rls");
    const { data, error } = await clientes.G1
      .from("biblioteca")
      .insert(enlaceNuevo())
      .select("id, organizacion_id, subido_por, archivado_en")
      .single();
    if (data) filasCreadas.push(data.id as string);
    expect(error).toBeNull();
    expect(data?.organizacion_id).toBe(org("A"));
    expect(data?.subido_por).toBe(idsUsuarios.G1);
    expect(data?.archivado_en).toBeNull();
  });

  it("D1 inserta un archivo con la ruta de su organización", async () => {
    const { data, error } = await clientes.D1.from("biblioteca").insert(archivoNuevo()).select("id, subido_por").single();
    if (data) filasCreadas.push(data.id as string);
    expect(error).toBeNull();
    expect(data?.subido_por).toBe(inject("rls").idsUsuarios.D1);
  });

  for (const actor of ["E1", "E3", "E4", "E5"] as const) {
    it(`${actor} no puede insertar un archivo ni un enlace (42501) y no aparece ninguna fila`, async () => {
      for (const fila of [archivoNuevo(), enlaceNuevo()]) {
        const { data, error } = await clientes[actor].from("biblioteca").insert(fila);
        expect(data).toBeNull();
        expect(error?.code).toBe(PERMISO_DENEGADO);
        expect(await filasConNombre(fila.nombre as string)).toEqual([]);
      }
    });
  }

  it("anon no puede insertar (42501)", async () => {
    const fila = enlaceNuevo();
    const { error } = await comoAnonimo().from("biblioteca").insert(fila);
    expect(error?.code).toBe(PERMISO_DENEGADO);
    expect(await filasConNombre(fila.nombre as string)).toEqual([]);
  });

  const COLUMNAS_DE_LA_BASE: { nombre: string; extra: () => Record<string, unknown> }[] = [
    { nombre: "organizacion_id (aunque sea la suya)", extra: () => ({ organizacion_id: org("A") }) },
    { nombre: "subido_por (aunque sea él)", extra: () => ({ subido_por: inject("rls").idsUsuarios.G1 }) },
    { nombre: "archivado_en", extra: () => ({ archivado_en: "2026-10-01T00:00:00Z" }) },
    { nombre: "creado_en", extra: () => ({ creado_en: "2020-01-01T00:00:00Z" }) },
  ];
  for (const caso of COLUMNAS_DE_LA_BASE) {
    it(`G1 no puede mandar ${caso.nombre} al insertar (42501)`, async () => {
      const fila = enlaceNuevo(caso.extra());
      const { error } = await clientes.G1.from("biblioteca").insert(fila);
      expect(error?.code).toBe(PERMISO_DENEGADO);
      expect(await filasConNombre(fila.nombre as string)).toEqual([]);
    });
  }

  it("G1 no puede insertar un archivo con la ruta de otra organización (23514)", async () => {
    const fila = archivoNuevo({ ruta: rutaNueva("B") });
    const { error } = await clientes.G1.from("biblioteca").insert(fila);
    expect(error?.code).toBe(CHECK_VIOLADO);
    expect(await filasConNombre(fila.nombre as string)).toEqual([]);
  });

  it("D2 (organización B) inserta en B y nadie de A lo ve", async () => {
    const { data, error } = await clientes.D2
      .from("biblioteca")
      .insert(archivoNuevo({ ruta: rutaNueva("B") }))
      .select("id, organizacion_id")
      .single();
    if (data) filasCreadas.push(data.id as string);
    expect(error).toBeNull();
    expect(data?.organizacion_id).toBe(org("B"));
    const visto = await clientes.D1.from("biblioteca").select("id").eq("id", data!.id);
    expect(visto.data).toEqual([]);
  });
});

describe("RLS biblioteca: restricciones de la tabla", () => {
  it("26,214,400 bytes se aceptan", async () => {
    const { data, error } = await clientes.G1
      .from("biblioteca")
      .insert(archivoNuevo({ tamano_bytes: TOPE_BYTES }))
      .select("id")
      .single();
    if (data) filasCreadas.push(data.id as string);
    expect(error).toBeNull();
  });

  const RECHAZOS: { nombre: string; fila: () => Record<string, unknown> }[] = [
    { nombre: "26,214,401 bytes", fila: () => archivoNuevo({ tamano_bytes: TOPE_BYTES + 1 }) },
    { nombre: "0 bytes", fila: () => archivoNuevo({ tamano_bytes: 0 }) },
    { nombre: "un enlace http", fila: () => enlaceNuevo({ enlace: "http://videos.ejemplo.test/x" }) },
    { nombre: "un enlace con usuario y contraseña", fila: () => enlaceNuevo({ enlace: "https://usuario:clave@videos.ejemplo.test/x" }) },
    { nombre: "un enlace con usuario", fila: () => enlaceNuevo({ enlace: "https://usuario@videos.ejemplo.test/x" }) },
    { nombre: "un enlace con espacios", fila: () => enlaceNuevo({ enlace: "https://videos.ejemplo.test/a b" }) },
    { nombre: "un enlace javascript:", fila: () => enlaceNuevo({ enlace: "javascript:alert(1)" }) },
    { nombre: "un enlace de 501 caracteres", fila: () => enlaceNuevo({ enlace: `https://ejemplo.test/${"a".repeat(481)}` }) },
    { nombre: "un archivo sin ruta", fila: () => archivoNuevo({ ruta: null }) },
    { nombre: "un archivo sin tamaño", fila: () => archivoNuevo({ tamano_bytes: null }) },
    { nombre: "un archivo con enlace", fila: () => archivoNuevo({ enlace: "https://ejemplo.test/x" }) },
    { nombre: "un enlace sin URL", fila: () => enlaceNuevo({ enlace: null }) },
    { nombre: "un enlace con ruta", fila: () => enlaceNuevo({ ruta: rutaNueva("A") }) },
    { nombre: "un tipo MIME no permitido", fila: () => archivoNuevo({ tipo_mime: "text/html" }) },
    { nombre: "una ruta que no es organización/uuid.ext", fila: () => archivoNuevo({ ruta: `${org("A")}/../otro.pdf` }) },
    { nombre: "un nombre vacío", fila: () => enlaceNuevo({ nombre: "   " }) },
    { nombre: "un nombre de 151 caracteres", fila: () => enlaceNuevo({ nombre: "N".repeat(151) }) },
    { nombre: "una descripción de 501 caracteres", fila: () => enlaceNuevo({ descripcion: "d".repeat(501) }) },
    { nombre: "una CLABE en el nombre", fila: () => enlaceNuevo({ nombre: `Cuenta 012180001234567891 ${MARCA}` }) },
    { nombre: "un RFC en la descripción", fila: () => enlaceNuevo({ descripcion: "Contrato de GODE561231GR8" }) },
    {
      nombre: "18 dígitos repartidos entre el nombre y la descripción",
      fila: () => enlaceNuevo({ nombre: "Lista 012180001", descripcion: "234567891" }),
    },
  ];
  for (const caso of RECHAZOS) {
    it(`rechaza ${caso.nombre} (23514)`, async () => {
      const fila = caso.fila();
      const { error } = await clientes.G1.from("biblioteca").insert(fila);
      expect(error?.code).toBe(CHECK_VIOLADO);
      expect(await filasConNombre(fila.nombre as string)).toEqual([]);
    });
  }

  it("rechaza una categoría que no existe (22P02)", async () => {
    const fila = enlaceNuevo({ categoria: "OTRA" });
    const { error } = await clientes.G1.from("biblioteca").insert(fila);
    expect(error?.code).toBe("22P02");
  });
});

describe("RLS biblioteca: archivar solo Director regional y Gerente", () => {
  for (const actor of ["E1", "E3"] as const) {
    it(`${actor} no puede archivar (0 filas) y el elemento sigue activo`, async () => {
      const a = await crearFila({});
      const { data, error } = await clientes[actor]
        .from("biblioteca")
        .update({ archivado_en: new Date().toISOString() })
        .eq("id", a.id)
        .select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
      const fila = await admin.from("biblioteca").select("archivado_en").eq("id", a.id).single();
      expect(fila.data?.archivado_en).toBeNull();
    });
  }

  for (const actor of ["G1", "G2", "D1"] as const) {
    it(`${actor} archiva, la hora la pone el servidor y E1 deja de verlo`, async () => {
      const a = await crearFila({});
      const antes = Date.now();
      const { data, error } = await clientes[actor]
        .from("biblioteca")
        .update({ archivado_en: "2000-01-01T00:00:00Z" })
        .eq("id", a.id)
        .select("archivado_en")
        .single();
      expect(error).toBeNull();
      expect(new Date(data!.archivado_en as string).getTime()).toBeGreaterThan(antes - 60_000);
      const e1 = await clientes.E1.from("biblioteca").select("id").eq("id", a.id);
      expect(e1.data).toEqual([]);
      const d1 = await clientes.D1.from("biblioteca").select("id").eq("id", a.id);
      expect(d1.data).toEqual([{ id: a.id }]);
    });
  }

  for (const columna of ["nombre", "descripcion", "categoria", "enlace", "ruta", "organizacion_id", "subido_por"] as const) {
    it(`G1 no puede cambiar ${columna} (42501)`, async () => {
      const a = await crearFila({});
      const valores: Record<string, unknown> = {
        nombre: nombreNuevo(),
        descripcion: "Otra.",
        categoria: "HERRAMIENTAS",
        enlace: "https://ejemplo.test/x",
        ruta: rutaNueva("A"),
        organizacion_id: org("A"),
        subido_por: inject("rls").idsUsuarios.G1,
      };
      const { error } = await clientes.G1.from("biblioteca").update({ [columna]: valores[columna] }).eq("id", a.id);
      expect(error?.code).toBe(PERMISO_DENEGADO);
    });
  }

  it("D2 (organización B) no puede archivar uno de A (0 filas)", async () => {
    const a = await crearFila({});
    const { data } = await clientes.D2
      .from("biblioteca")
      .update({ archivado_en: new Date().toISOString() })
      .eq("id", a.id)
      .select("id");
    expect(data ?? []).toEqual([]);
    const fila = await admin.from("biblioteca").select("archivado_en").eq("id", a.id).single();
    expect(fila.data?.archivado_en).toBeNull();
  });

  it("anon no puede archivar (42501)", async () => {
    const a = await crearFila({});
    const { error } = await comoAnonimo().from("biblioteca").update({ archivado_en: new Date().toISOString() }).eq("id", a.id);
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });
});

describe("RLS biblioteca: nadie borra (se archiva)", () => {
  for (const actor of ["E1", "G1", "D1", "D2"] as const) {
    it(`${actor} no puede borrar (42501) y la fila sigue`, async () => {
      const a = await crearFila({});
      const { error } = await clientes[actor].from("biblioteca").delete().eq("id", a.id);
      expect(error?.code).toBe(PERMISO_DENEGADO);
      const fila = await admin.from("biblioteca").select("id").eq("id", a.id);
      expect(fila.data).toEqual([{ id: a.id }]);
      await confirmarDatosBase();
    });
  }

  it("anon no puede borrar (42501)", async () => {
    const a = await crearFila({});
    const { error } = await comoAnonimo().from("biblioteca").delete().eq("id", a.id);
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });
});

describe("RLS biblioteca: bucket privado", () => {
  it("el bucket es privado, con tope de 26,214,400 bytes y solo los 12 tipos permitidos", async () => {
    const { data, error } = await admin.storage.getBucket(BUCKET);
    expect(error).toBeNull();
    expect(data?.public).toBe(false);
    expect(Number(data?.file_size_limit)).toBe(TOPE_BYTES);
    expect([...(data?.allowed_mime_types ?? [])].sort()).toEqual([...TIPOS_PERMITIDOS].sort());
  });

  for (const actor of ["G1", "D1"] as const) {
    it(`${actor} sube un objeto con el prefijo de su organización`, async () => {
      const ruta = rutaNueva("A");
      const { error } = await clientes[actor].storage.from(BUCKET).upload(ruta, bytesPdf(), { contentType: PDF });
      if (!error) objetosCreados.push(ruta);
      expect(error).toBeNull();
      expect(await existeObjeto(ruta)).toBe(true);
    });
  }

  for (const actor of ["E1", "E3", "E4", "E5"] as const) {
    it(`${actor} no puede subir un objeto`, async () => {
      const ruta = rutaNueva(actor === "E4" ? "B" : "A");
      const { error } = await clientes[actor].storage.from(BUCKET).upload(ruta, bytesPdf(), { contentType: PDF });
      if (!error) objetosCreados.push(ruta);
      expect(error).not.toBeNull();
      expect(await existeObjeto(ruta)).toBe(false);
    });
  }

  it("anon no puede subir un objeto", async () => {
    const ruta = rutaNueva("A");
    const { error } = await comoAnonimo().storage.from(BUCKET).upload(ruta, bytesPdf(), { contentType: PDF });
    if (!error) objetosCreados.push(ruta);
    expect(error).not.toBeNull();
    expect(await existeObjeto(ruta)).toBe(false);
  });

  const RUTAS_PROHIBIDAS: { nombre: string; ruta: () => string }[] = [
    { nombre: "con el prefijo de otra organización", ruta: () => rutaNueva("B") },
    { nombre: "fuera de una carpeta", ruta: () => `${randomUUID()}.pdf` },
    { nombre: "en una subcarpeta", ruta: () => `${org("A")}/sub/${randomUUID()}.pdf` },
    { nombre: "con un nombre que no es uuid", ruta: () => `${org("A")}/manual.pdf` },
  ];
  for (const caso of RUTAS_PROHIBIDAS) {
    it(`G1 no puede subir ${caso.nombre}`, async () => {
      const ruta = caso.ruta();
      const { error } = await clientes.G1.storage.from(BUCKET).upload(ruta, bytesPdf(), { contentType: PDF });
      if (!error) objetosCreados.push(ruta);
      expect(error).not.toBeNull();
      expect(await existeObjeto(ruta)).toBe(false);
    });
  }

  it("el bucket rechaza un tipo no permitido (text/html)", async () => {
    const ruta = rutaNueva("A", "html");
    const { error } = await clientes.G1.storage
      .from(BUCKET)
      .upload(ruta, new TextEncoder().encode("<p>hola</p>"), { contentType: "text/html" });
    if (!error) objetosCreados.push(ruta);
    expect(error).not.toBeNull();
  });

  it("el bucket rechaza 26,214,401 bytes", async () => {
    const ruta = rutaNueva("A");
    const { error } = await clientes.G1.storage.from(BUCKET).upload(ruta, bytesPdf(TOPE_BYTES + 1), { contentType: PDF });
    if (!error) objetosCreados.push(ruta);
    expect(error).not.toBeNull();
    expect(await existeObjeto(ruta)).toBe(false);
  });

  it("E1 descarga un objeto cuya fila está activa", async () => {
    const { ruta } = await crearFila({});
    await crearObjeto(ruta);
    const { data, error } = await clientes.E1.storage.from(BUCKET).download(ruta);
    expect(error).toBeNull();
    expect(data?.size).toBe(64);
    const firmada = await clientes.E1.storage.from(BUCKET).createSignedUrl(ruta, 60);
    expect(firmada.error).toBeNull();
  });

  it("E1 no descarga un objeto archivado ni uno sin fila; G1 y D1 sí", async () => {
    const archivado = await crearFila({ archivado: true });
    await crearObjeto(archivado.ruta);
    const sinFila = rutaNueva("A");
    await crearObjeto(sinFila);
    for (const ruta of [archivado.ruta, sinFila]) {
      const e1 = await clientes.E1.storage.from(BUCKET).download(ruta);
      expect(e1.data).toBeNull();
      expect(e1.error).not.toBeNull();
      const firmada = await clientes.E1.storage.from(BUCKET).createSignedUrl(ruta, 60);
      expect(firmada.data).toBeNull();
      for (const actor of ["G1", "D1"] as const) {
        const { error } = await clientes[actor].storage.from(BUCKET).download(ruta);
        expect(error, actor).toBeNull();
      }
    }
  });

  it("la organización B (D2 y E4) no descarga, no firma ni lista objetos de A", async () => {
    const { ruta } = await crearFila({});
    await crearObjeto(ruta);
    for (const actor of ["D2", "E4"] as const) {
      const descarga = await clientes[actor].storage.from(BUCKET).download(ruta);
      expect(descarga.data, actor).toBeNull();
      const firmada = await clientes[actor].storage.from(BUCKET).createSignedUrl(ruta, 60);
      expect(firmada.data, actor).toBeNull();
      const lista = await clientes[actor].storage.from(BUCKET).list(org("A"));
      expect(lista.data ?? [], actor).toEqual([]);
    }
  });

  it("un usuario inactivo (E5) y anon no descargan ni listan", async () => {
    const { ruta } = await crearFila({});
    await crearObjeto(ruta);
    for (const cliente of [clientes.E5, comoAnonimo()]) {
      const descarga = await cliente.storage.from(BUCKET).download(ruta);
      expect(descarga.data).toBeNull();
      const lista = await cliente.storage.from(BUCKET).list(org("A"));
      expect(lista.data ?? []).toEqual([]);
    }
  });

  it("nadie borra un objeto: E1, G1, D1, D2 y anon lo intentan y sigue ahí", async () => {
    const { ruta } = await crearFila({});
    await crearObjeto(ruta);
    for (const cliente of [clientes.E1, clientes.G1, clientes.D1, clientes.D2, comoAnonimo()]) {
      await cliente.storage.from(BUCKET).remove([ruta]);
      expect(await existeObjeto(ruta)).toBe(true);
    }
  });

  it("nadie reemplaza un objeto: G1 y D1 con upsert fallan y el contenido no cambia", async () => {
    const { ruta } = await crearFila({});
    await crearObjeto(ruta);
    for (const actor of ["G1", "D1"] as const) {
      const { error } = await clientes[actor].storage
        .from(BUCKET)
        .upload(ruta, bytesPdf(128), { contentType: PDF, upsert: true });
      expect(error, actor).not.toBeNull();
    }
    const { data } = await admin.storage.from(BUCKET).download(ruta);
    expect(data?.size).toBe(64);
  });

  it("nadie mueve un objeto a otra ruta", async () => {
    const { ruta } = await crearFila({});
    await crearObjeto(ruta);
    const destino = rutaNueva("A");
    const mover = await clientes.G1.storage.from(BUCKET).move(ruta, destino);
    expect(mover.error).not.toBeNull();
    expect(await existeObjeto(ruta)).toBe(true);
    expect(await existeObjeto(destino)).toBe(false);
  });
});
