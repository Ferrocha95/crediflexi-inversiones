// Integración del pipeline: las acciones y consultas reales de la app contra
// Supabase local, con usuarios reales que inician sesión. Solo se simulan el
// encabezado Host, la revalidación de Next y la fábrica del cliente de
// Supabase (que en la app lee las cookies): aquí devuelve el cliente con la
// sesión del usuario de la prueba, así que todo pasa por RLS.
//
// Datos sintéticos; todo lo creado se borra al final de cada prueba.

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "127.0.0.1:3000" }),
  cookies: async () => {
    throw new Error("En esta prueba el cliente de Supabase no lee cookies.");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const actual = vi.hoisted(() => ({ cliente: null as unknown }));
vi.mock("../../src/servidor/supabase/servidor", () => ({
  crearClienteServidor: async () => {
    if (actual.cliente === null) throw new Error("La prueba no inició sesión.");
    return actual.cliente;
  },
}));

import { archivarProspecto, crearProspecto, editarProspecto, restaurarProspecto } from "../../src/app/(app)/pipeline/acciones";
import { MENSAJE_SESION_EXPIRADA } from "../../src/componentes/acceso/textos";
import { contarArchivados, ejecutivosVisibles, listarProspectos } from "../../src/servidor/pipeline/consultas";
import { Registro, comoAdmin, type UsuarioCreado } from "./admin";
import { iniciarSesion } from "./clientes";

const admin = comoAdmin();
const reg = new Registro(admin);

let gerente: UsuarioCreado;
let ejecutivo: UsuarioCreado;
let ajeno: UsuarioCreado;

async function como(u: UsuarioCreado): Promise<SupabaseClient> {
  const c = await iniciarSesion(u.correo, u.contrasena);
  actual.cliente = c;
  return c;
}

const datos = (cambios: Record<string, string> = {}) => ({
  nombre: "Prospecto Sintético Pipeline",
  contacto: "55 1234 5678",
  comentarios: "Llamar el 15/10",
  estatus: "INTERESADO",
  seguimiento: "15/10/2026",
  ...cambios,
});

async function filaAdmin(id: string) {
  const { data, error } = await admin.from("prospectos").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

/** Crea un prospecto con la acción, como el usuario indicado, y lo anota para borrarlo. */
async function crearComo(u: UsuarioCreado, cambios: Record<string, string> = {}): Promise<string> {
  await como(u);
  const r = await crearProspecto(datos(cambios));
  if (!r.ok) throw new Error(`No se pudo crear: ${r.mensaje} ${JSON.stringify(r.errores)}`);
  reg.anotar("prospectos", [{ id: r.id }]);
  return r.id;
}

beforeEach(async () => {
  const org = await reg.crearOrganizacion("Pipeline");
  const suc = await reg.crearSucursal(org, "Pipeline");
  gerente = await reg.crearUsuario({ sucursalId: suc, rol: "GERENTE" });
  ejecutivo = await reg.crearUsuario({ sucursalId: suc, jefeId: gerente.id });
  const otraOrg = await reg.crearOrganizacion("Ajena");
  ajeno = await reg.crearUsuario({ sucursalId: await reg.crearSucursal(otraOrg, "Ajena") });
});

afterEach(async () => {
  actual.cliente = null;
  await reg.limpiar();
});

describe("pipeline: acciones contra Supabase local", () => {
  it("crear guarda a nombre de quien inicia sesión, con los datos normalizados", async () => {
    const id = await crearComo(ejecutivo);
    expect(await filaAdmin(id)).toMatchObject({
      ejecutivo_id: ejecutivo.id,
      nombre: "Prospecto Sintético Pipeline",
      contacto: "5512345678",
      comentarios: "Llamar el 15/10",
      estatus: "INTERESADO",
      seguimiento: "2026-10-15",
      archivado_en: null,
    });
  });

  it("crear avisa (sin bloquear) si el teléfono ya está en otro prospecto activo visible", async () => {
    await crearComo(ejecutivo, { nombre: "Prospecto Sintético Uno" });
    const r = await crearProspecto(datos({ nombre: "Prospecto Sintético Dos" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      reg.anotar("prospectos", [{ id: r.id }]);
      expect(r.avisos).toEqual(["El teléfono 55 1234 5678 ya está en otro prospecto activo (Prospecto Sintético Uno). Puedes guardar de todos modos."]);
    }
  });

  it("editar cambia los campos del prospecto propio", async () => {
    const id = await crearComo(ejecutivo);
    const r = await editarProspecto(id, datos({ estatus: "no interesado", comentarios: "Ya invirtió en otro lado", seguimiento: "" }));
    expect(r).toMatchObject({ ok: true, id });
    expect(await filaAdmin(id)).toMatchObject({ estatus: "NO_INTERESADO", comentarios: "Ya invirtió en otro lado", seguimiento: null, ejecutivo_id: ejecutivo.id });
  });

  it("archivar pone la hora del servidor, cuenta como archivado (con RLS) y restaurar la quita", async () => {
    const id = await crearComo(ejecutivo);
    const antes = Date.now();
    expect(await archivarProspecto(id)).toMatchObject({ ok: true, id });
    const archivado = await filaAdmin(id);
    expect(archivado.archivado_en).not.toBeNull();
    expect(Math.abs(new Date(archivado.archivado_en).getTime() - antes)).toBeLessThan(60_000);

    const cliente = actual.cliente as SupabaseClient;
    expect((await listarProspectos(cliente, { archivados: false })).map((p) => p.id)).not.toContain(id);
    expect((await listarProspectos(cliente, { archivados: true })).map((p) => p.id)).toContain(id);

    expect(await contarArchivados(cliente)).toBe(1);
    expect(await contarArchivados(await como(gerente))).toBe(1);
    expect(await contarArchivados(await como(ajeno))).toBe(0);
    await como(ejecutivo);

    expect(await restaurarProspecto(id)).toMatchObject({ ok: true, id });
    expect((await filaAdmin(id)).archivado_en).toBeNull();
    expect((await listarProspectos(cliente, { archivados: false })).map((p) => p.id)).toContain(id);
    expect(await contarArchivados(cliente)).toBe(0);
  });

  it("un prospecto archivado no se edita: hay que restaurarlo antes", async () => {
    const id = await crearComo(ejecutivo);
    await archivarProspecto(id);
    expect(await editarProspecto(id, datos({ nombre: "Otro nombre" }))).toEqual({
      ok: false,
      mensaje: "Este prospecto está archivado. Restáuralo antes de editarlo.",
      errores: {},
    });
    expect((await filaAdmin(id)).nombre).toBe("Prospecto Sintético Pipeline");
  });

  it("un superior ve el prospecto de su equipo pero no puede editarlo, archivarlo ni restaurarlo", async () => {
    const id = await crearComo(ejecutivo);
    const clienteGerente = await como(gerente);
    expect((await listarProspectos(clienteGerente, { archivados: false })).map((p) => p.id)).toContain(id);

    expect(await editarProspecto(id, datos({ nombre: "Cambio del gerente" }))).toEqual({
      ok: false,
      mensaje: "Solo el dueño puede editar este prospecto.",
      errores: {},
    });
    expect(await archivarProspecto(id)).toEqual({ ok: false, mensaje: "Solo el dueño puede archivar este prospecto.", errores: {} });
    expect(await restaurarProspecto(id)).toEqual({ ok: false, mensaje: "Solo el dueño puede restaurar este prospecto.", errores: {} });

    const fila = await filaAdmin(id);
    expect(fila.nombre).toBe("Prospecto Sintético Pipeline");
    expect(fila.archivado_en).toBeNull();
  });

  it("un usuario de otra organización no encuentra el prospecto", async () => {
    const id = await crearComo(ejecutivo);
    await como(ajeno);
    expect(await editarProspecto(id, datos())).toEqual({
      ok: false,
      mensaje: "No se encontró el prospecto. Puede que ya no exista o que no tengas acceso; recarga la página.",
      errores: {},
    });
  });

  it("la base rechaza lo que la app no detectó y el mensaje sale en español (prueba directa del mapa de errores)", async () => {
    const cliente = await como(ejecutivo);
    const { error } = await cliente
      .from("prospectos")
      .insert({ nombre: "Prospecto Sintético", contacto: "12345", estatus: "INTERESADO" })
      .select("id");
    expect(error?.code).toBe("23514");
    const { mensajeDeErrorBase } = await import("../../src/aplicacion/pipeline/errores");
    expect(mensajeDeErrorBase(error!)).toBe("El contacto debe tener 10 dígitos.");
  });

  it("un usuario desactivado a media sesión recibe el aviso de sesión expirada", async () => {
    const id = await crearComo(ejecutivo);
    await admin.from("usuarios").update({ activo: false }).eq("id", ejecutivo.id);
    expect(await editarProspecto(id, datos({ nombre: "Cambio" }))).toEqual({ ok: false, mensaje: MENSAJE_SESION_EXPIRADA, errores: {} });
    expect(await crearProspecto(datos())).toEqual({ ok: false, mensaje: MENSAJE_SESION_EXPIRADA, errores: {} });
  });
});

describe("pipeline: consultas con la sesión del usuario", () => {
  it("el ejecutivo ve solo lo suyo; el gerente, lo de su equipo con el nombre del ejecutivo", async () => {
    const idEjecutivo = await crearComo(ejecutivo, { nombre: "Prospecto Sintético Ejecutivo", contacto: "5500000101" });
    const idAjeno = await crearComo(ajeno, { nombre: "Prospecto Sintético Ajeno", contacto: "5500000102" });

    const clienteEjecutivo = await como(ejecutivo);
    const propios = await listarProspectos(clienteEjecutivo, { archivados: false });
    expect(propios.map((p) => p.id)).toEqual([idEjecutivo]);
    expect(propios[0]).toMatchObject({
      ejecutivoId: ejecutivo.id,
      nombre: "Prospecto Sintético Ejecutivo",
      contacto: "5500000101",
      estatus: "INTERESADO",
      seguimiento: "2026-10-15",
      archivadoEn: null,
    });
    expect((await ejecutivosVisibles(clienteEjecutivo)).map((e) => e.id)).toEqual([ejecutivo.id]);

    const clienteGerente = await como(gerente);
    const delEquipo = await listarProspectos(clienteGerente, { archivados: false });
    expect(delEquipo.map((p) => p.id)).toEqual([idEjecutivo]);
    expect(delEquipo.map((p) => p.id)).not.toContain(idAjeno);
    const nombreEjecutivo = (await admin.from("usuarios").select("nombre").eq("id", ejecutivo.id).single()).data?.nombre;
    expect(delEquipo[0].ejecutivo).toBe(nombreEjecutivo);
    expect((await ejecutivosVisibles(clienteGerente)).map((e) => e.id).sort()).toEqual([gerente.id, ejecutivo.id].sort());
  });
});
