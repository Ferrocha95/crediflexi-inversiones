// Pruebas de RLS sobre public.prospectos.
//
// Lectura: el dueño, sus superiores por la cadena de mando (gerentes) y los
// directores de su organización. Escritura: solo el dueño, a su propio nombre,
// sin reasignar y sin borrar (se archiva). Un usuario inactivo no ve ni escribe
// nada y anon no tiene acceso.
//
// Los prospectos base (fixtures.ts) nunca se modifican: las escrituras que
// deben funcionar usan filas propias que se borran en afterEach, y las que
// deben fallar se comprueban contra la foto de datos base.

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeAll, beforeEach, describe, expect, inject, it } from "vitest";
import { Registro, comoAdmin, sufijo } from "./admin";
import {
  CHECK_VIOLADO,
  PERMISO_DENEGADO,
  clavesDe,
  esperarSinFilasOPermisoDenegado,
  ordenadas,
} from "./ayudas";
import { comoAnonimo, comoUsuario } from "./clientes";
import { MARCA, type ClaveProspecto, type ClaveUsuario } from "./fixtures";
import { tomarFotoBase } from "./foto";

type Actor = "E1" | "E2" | "E3" | "E4" | "E5" | "E6" | "G1" | "G2" | "D1" | "D2";
const ACTORES: Actor[] = ["E1", "E2", "E3", "E4", "E5", "E6", "G1", "G2", "D1", "D2"];

const clientes = {} as Record<Actor, SupabaseClient>;
const admin = comoAdmin();
let reg: Registro;

beforeAll(async () => {
  for (const actor of ACTORES) clientes[actor] = await comoUsuario(actor);
});

beforeEach(() => {
  reg = new Registro(admin);
});

afterEach(async () => {
  await reg.limpiar();
});

/** Fila válida para insertar como cliente, sin columnas que fija el servidor. */
function filaNueva(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nombre: `Prospecto Sintético ${sufijo()} ${MARCA}`,
    contacto: "5500000010",
    comentarios: "Llamar después de las 5.",
    estatus: "INTERESADO",
    seguimiento: "2026-10-09",
    ...extra,
  };
}

/** Los datos base siguen idénticos y no apareció ninguna fila con ese nombre. */
async function confirmarSinCambios(nombreIntentado?: string): Promise<void> {
  const rls = inject("rls");
  expect(await tomarFotoBase(admin, rls)).toEqual(rls.fotoBase);
  if (nombreIntentado) {
    const { data, error } = await admin.from("prospectos").select("id").eq("nombre", nombreIntentado);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  }
}

/** Busca con el administrador una fila insertada sin RETURNING y la anota para borrarla. */
async function filaInsertada(nombre: string) {
  const { data, error } = await admin.from("prospectos").select("*").eq("nombre", nombre);
  expect(error).toBeNull();
  reg.anotar("prospectos", data as { id: string }[]);
  return data ?? [];
}

describe("RLS prospectos: lectura según dueño, cadena de mando y organización", () => {
  const CASOS: { nombre: string; quien: Actor; ve: ClaveProspecto[] }[] = [
    { nombre: "un ejecutivo (E1) ve solo los suyos, incluido el archivado", quien: "E1", ve: ["PE1", "PE1x"] },
    { nombre: "un ejecutivo (E2) ve solo el suyo", quien: "E2", ve: ["PE2"] },
    { nombre: "un ejecutivo de otra sucursal (E3) ve solo el suyo", quien: "E3", ve: ["PE3"] },
    { nombre: "un ejecutivo con jefe en otra sucursal (E6) ve solo el suyo", quien: "E6", ve: ["PE6"] },
    { nombre: "un ejecutivo de otra organización (E4) ve solo el suyo", quien: "E4", ve: ["PE4"] },
    { nombre: "un usuario inactivo (E5) no ve ninguno, ni el suyo", quien: "E5", ve: [] },
    {
      nombre: "el gerente G1 ve los suyos y los de toda su cadena: el inactivo, el de otra sucursal y los archivados",
      quien: "G1",
      ve: ["PG1", "PE1", "PE1x", "PE2", "PE5", "PE6"],
    },
    {
      nombre: "el gerente G2 ve los de su subordinado y no el de E6 aunque comparten sucursal",
      quien: "G2",
      ve: ["PE3"],
    },
    {
      nombre: "el director D1 ve todos los de su organización y ninguno de la otra",
      quien: "D1",
      ve: ["PG1", "PE1", "PE1x", "PE2", "PE3", "PE5", "PE6"],
    },
    { nombre: "el director D2 ve los de su organización y ninguno de la otra", quien: "D2", ve: ["PE4"] },
  ];

  for (const caso of CASOS) {
    it(caso.nombre, async () => {
      const { idsProspectos } = inject("rls");
      const { data, error } = await clientes[caso.quien].from("prospectos").select("id");
      expect(error).toBeNull();
      expect(clavesDe(data ?? [], idsProspectos)).toEqual(ordenadas(caso.ve));
    });
  }

  it("anon no ve ningún prospecto (o recibe permisos denegados)", async () => {
    esperarSinFilasOPermisoDenegado(await comoAnonimo().from("prospectos").select("id"));
  });

  it("un ejecutivo (E1) no ve, ni filtrando por id, el de su compañero, el de su gerente ni el de otra organización", async () => {
    const { idsProspectos } = inject("rls");
    const { data, error } = await clientes.E1
      .from("prospectos")
      .select("id")
      .in("id", [idsProspectos.PE2, idsProspectos.PG1, idsProspectos.PE4]);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("RLS prospectos: insertar solo a nombre propio", () => {
  it("E1 inserta uno propio con RETURNING: el ejecutivo es E1 y nace activo", async () => {
    const { idsUsuarios } = inject("rls");
    const { data, error } = await clientes.E1
      .from("prospectos")
      .insert(filaNueva())
      .select("id, ejecutivo_id, archivado_en")
      .single();
    reg.anotar("prospectos", data ? [data] : null);
    expect(error).toBeNull();
    expect(data?.ejecutivo_id).toBe(idsUsuarios.E1);
    expect(data?.archivado_en).toBeNull();
  });

  it("E1 inserta uno propio sin RETURNING y el administrador lo encuentra a nombre de E1", async () => {
    const { idsUsuarios } = inject("rls");
    const fila = filaNueva();
    const { error } = await clientes.E1.from("prospectos").insert(fila);
    expect(error).toBeNull();
    const filas = await filaInsertada(fila.nombre as string);
    expect(filas).toHaveLength(1);
    expect(filas[0].ejecutivo_id).toBe(idsUsuarios.E1);
  });

  const INTENTOS: { nombre: string; actor: Actor; extra: (ids: Record<ClaveUsuario, string>) => Record<string, unknown> }[] = [
    { nombre: "E1 no puede insertar a nombre de E2 (42501)", actor: "E1", extra: (ids) => ({ ejecutivo_id: ids.E2 }) },
    {
      nombre: "E1 no puede mandar ejecutivo_id aunque sea el suyo (42501)",
      actor: "E1",
      extra: (ids) => ({ ejecutivo_id: ids.E1 }),
    },
    { nombre: "E4 no puede insertar a nombre de E1, de otra organización (42501)", actor: "E4", extra: (ids) => ({ ejecutivo_id: ids.E1 }) },
    { nombre: "G1 no puede insertar a nombre de su subordinado E1 (42501)", actor: "G1", extra: (ids) => ({ ejecutivo_id: ids.E1 }) },
    { nombre: "D1 no puede insertar a nombre de E1 (42501)", actor: "D1", extra: (ids) => ({ ejecutivo_id: ids.E1 }) },
    {
      nombre: "E1 no puede fijar archivado_en al insertar (42501)",
      actor: "E1",
      extra: () => ({ archivado_en: "2026-10-01T00:00:00Z" }),
    },
    { nombre: "E1 no puede fijar creado_en al insertar (42501)", actor: "E1", extra: () => ({ creado_en: "2020-01-01T00:00:00Z" }) },
    { nombre: "un usuario inactivo (E5) no puede insertar ni a su nombre (42501)", actor: "E5", extra: () => ({}) },
  ];

  for (const intento of INTENTOS) {
    it(`${intento.nombre} y no aparece ninguna fila`, async () => {
      const fila = filaNueva(intento.extra(inject("rls").idsUsuarios));
      const { data, error } = await clientes[intento.actor].from("prospectos").insert(fila);
      expect(data).toBeNull();
      expect(error?.code).toBe(PERMISO_DENEGADO);
      await filaInsertada(fila.nombre as string);
      await confirmarSinCambios(fila.nombre as string);
    });
  }

  it("anon no puede insertar (42501) y no aparece ninguna fila", async () => {
    const fila = filaNueva();
    const { data, error } = await comoAnonimo().from("prospectos").insert(fila);
    expect(data).toBeNull();
    expect(error?.code).toBe(PERMISO_DENEGADO);
    await filaInsertada(fila.nombre as string);
    await confirmarSinCambios(fila.nombre as string);
  });

  it("el gerente G1 inserta uno propio: D1 lo ve y E1 no", async () => {
    const { data, error } = await clientes.G1.from("prospectos").insert(filaNueva()).select("id").single();
    reg.anotar("prospectos", data ? [data] : null);
    expect(error).toBeNull();
    const id = data!.id as string;

    const d1 = await clientes.D1.from("prospectos").select("id").eq("id", id);
    expect(d1.data).toEqual([{ id }]);
    const e1 = await clientes.E1.from("prospectos").select("id").eq("id", id);
    expect(e1.data).toEqual([]);
  });

  it("los checks también aplican por la API: un contacto con guiones da 23514", async () => {
    const fila = filaNueva({ contacto: "55-1234-5678" });
    const { error } = await clientes.E1.from("prospectos").insert(fila);
    expect(error?.code).toBe(CHECK_VIOLADO);
    await filaInsertada(fila.nombre as string);
  });
});

describe("RLS prospectos: solo el dueño actualiza, sin reasignar", () => {
  /** Un prospecto de E1 creado por el administrador para esta prueba. */
  async function propioDeE1(): Promise<string> {
    return reg.crearProspecto({ ejecutivoId: inject("rls").idsUsuarios.E1 });
  }

  it("E1 edita uno propio y actualizado_en avanza", async () => {
    const id = await propioDeE1();
    const antes = await admin.from("prospectos").select("actualizado_en").eq("id", id).single();
    const { data, error } = await clientes.E1
      .from("prospectos")
      .update({ estatus: "INTERMITENTE", comentarios: "Pidió más información.", seguimiento: "2026-10-12" })
      .eq("id", id)
      .select("estatus, actualizado_en");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].estatus).toBe("INTERMITENTE");
    expect(new Date(data![0].actualizado_en).getTime()).toBeGreaterThan(new Date(antes.data!.actualizado_en).getTime());
  });

  const AJENOS: { nombre: string; actor: Actor; objetivo: ClaveProspecto }[] = [
    { nombre: "E1 no actualiza el de su compañero E2", actor: "E1", objetivo: "PE2" },
    { nombre: "el gerente G1 no actualiza el de su subordinado E1", actor: "G1", objetivo: "PE1" },
    { nombre: "el director D1 no actualiza el de E1", actor: "D1", objetivo: "PE1" },
    { nombre: "el director D2 no actualiza el de E4", actor: "D2", objetivo: "PE4" },
    { nombre: "un usuario inactivo (E5) no actualiza ni el suyo", actor: "E5", objetivo: "PE5" },
  ];

  for (const caso of AJENOS) {
    it(`${caso.nombre}: 0 filas y los datos base no cambian`, async () => {
      const { idsProspectos } = inject("rls");
      const { data, error } = await clientes[caso.actor]
        .from("prospectos")
        .update({ comentarios: "Intento ajeno." })
        .eq("id", idsProspectos[caso.objetivo])
        .select("id");
      expect(error).toBeNull();
      expect(data).toEqual([]);
      await confirmarSinCambios();
    });
  }

  it("E1 no puede reasignar uno propio a E2 (42501)", async () => {
    const { idsUsuarios } = inject("rls");
    const id = await propioDeE1();
    const { error } = await clientes.E1.from("prospectos").update({ ejecutivo_id: idsUsuarios.E2 }).eq("id", id);
    expect(error?.code).toBe(PERMISO_DENEGADO);
    const fila = await admin.from("prospectos").select("ejecutivo_id").eq("id", id).single();
    expect(fila.data?.ejecutivo_id).toBe(idsUsuarios.E1);
  });

  it("E1 no puede mandar ejecutivo_id ni con su mismo valor (42501)", async () => {
    const { idsUsuarios } = inject("rls");
    const id = await propioDeE1();
    const { error } = await clientes.E1.from("prospectos").update({ ejecutivo_id: idsUsuarios.E1 }).eq("id", id);
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });

  it("E1 no puede cambiar creado_en (42501)", async () => {
    const id = await propioDeE1();
    const { error } = await clientes.E1.from("prospectos").update({ creado_en: "2020-01-01T00:00:00Z" }).eq("id", id);
    expect(error?.code).toBe(PERMISO_DENEGADO);
  });

  it("al archivar, archivado_en lo pone el servidor aunque el cliente mande otra fecha; al restaurar vuelve a nulo y el gerente lo sigue viendo", async () => {
    const id = await propioDeE1();
    const antes = Date.now();

    const archivar = await clientes.E1
      .from("prospectos")
      .update({ archivado_en: "2000-01-01T00:00:00Z" })
      .eq("id", id)
      .select("archivado_en")
      .single();
    expect(archivar.error).toBeNull();
    const archivadoEn = new Date(archivar.data!.archivado_en as string).getTime();
    expect(archivadoEn).toBeGreaterThan(antes - 60_000);

    const restaurar = await clientes.E1
      .from("prospectos")
      .update({ archivado_en: null })
      .eq("id", id)
      .select("archivado_en")
      .single();
    expect(restaurar.error).toBeNull();
    expect(restaurar.data!.archivado_en).toBeNull();

    const g1 = await clientes.G1.from("prospectos").select("id").eq("id", id);
    expect(g1.data).toEqual([{ id }]);
  });

  it("anon no puede actualizar (42501)", async () => {
    const { idsProspectos } = inject("rls");
    const { error } = await comoAnonimo()
      .from("prospectos")
      .update({ comentarios: "Intento anónimo." })
      .eq("id", idsProspectos.PE1);
    expect(error?.code).toBe(PERMISO_DENEGADO);
    await confirmarSinCambios();
  });
});

describe("RLS prospectos: nadie borra (se archiva)", () => {
  it("E1 no puede borrar uno propio (42501) y la fila sigue", async () => {
    const id = await reg.crearProspecto({ ejecutivoId: inject("rls").idsUsuarios.E1 });
    const { error } = await clientes.E1.from("prospectos").delete().eq("id", id);
    expect(error?.code).toBe(PERMISO_DENEGADO);
    const fila = await admin.from("prospectos").select("id").eq("id", id);
    expect(fila.data).toEqual([{ id }]);
  });

  for (const actor of ["G1", "D1"] as const) {
    it(`${actor} no puede borrar el de E1 (42501) y los datos base no cambian`, async () => {
      const { error } = await clientes[actor].from("prospectos").delete().eq("id", inject("rls").idsProspectos.PE1);
      expect(error?.code).toBe(PERMISO_DENEGADO);
      await confirmarSinCambios();
    });
  }

  it("anon no puede borrar (42501)", async () => {
    const { error } = await comoAnonimo().from("prospectos").delete().eq("id", inject("rls").idsProspectos.PE1);
    expect(error?.code).toBe(PERMISO_DENEGADO);
    await confirmarSinCambios();
  });
});
