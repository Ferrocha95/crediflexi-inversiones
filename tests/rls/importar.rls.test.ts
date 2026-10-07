// Integración de la importación: confirmarImportacion real contra Supabase
// local, con usuarios reales que inician sesión. Como en pipeline.rls.test.ts,
// solo se simulan el Host, la revalidación de Next y la fábrica del cliente
// (que devuelve el cliente con la sesión del usuario de la prueba).
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

import { confirmarImportacion } from "../../src/app/(app)/pipeline/acciones";
import { Registro, comoAdmin, type UsuarioCreado } from "./admin";
import { iniciarSesion } from "./clientes";

const admin = comoAdmin();
const reg = new Registro(admin);

let gerente: UsuarioCreado;
let ejecutivo: UsuarioCreado;

async function como(u: UsuarioCreado): Promise<SupabaseClient> {
  const c = await iniciarSesion(u.correo, u.contrasena);
  actual.cliente = c;
  return c;
}

const fila = (n: number, cambios: Record<string, string> = {}) => ({
  fila: n,
  datos: {
    nombre: `Prospecto Sintético Importado ${n}`,
    contacto: `55000004${String(n).padStart(2, "0")}`,
    comentarios: "",
    estatus: "INTERESADO",
    seguimiento: "2026-10-20",
    ...cambios,
  },
});

/** Prospectos del usuario según el administrador; los anota para borrarlos. */
async function prospectosDe(u: UsuarioCreado): Promise<{ id: string; nombre: string; ejecutivo_id: string }[]> {
  const { data, error } = await admin.from("prospectos").select("id, nombre, ejecutivo_id").eq("ejecutivo_id", u.id).order("nombre");
  if (error) throw new Error(error.message);
  reg.anotar("prospectos", data);
  return data;
}

beforeEach(async () => {
  const org = await reg.crearOrganizacion("Importar");
  const suc = await reg.crearSucursal(org, "Importar");
  gerente = await reg.crearUsuario({ sucursalId: suc, rol: "GERENTE" });
  ejecutivo = await reg.crearUsuario({ sucursalId: suc, jefeId: gerente.id });
});

afterEach(async () => {
  actual.cliente = null;
  await prospectosDe(gerente);
  await prospectosDe(ejecutivo);
  await reg.limpiar();
});

describe("confirmarImportacion contra Supabase local", () => {
  it("inserta todas las filas a nombre de quien importa", async () => {
    await como(ejecutivo);
    expect(await confirmarImportacion([fila(4), fila(5)])).toEqual({ ok: true, insertadas: 2 });
    const filas = await prospectosDe(ejecutivo);
    expect(filas.map((f) => f.nombre)).toEqual(["Prospecto Sintético Importado 4", "Prospecto Sintético Importado 5"]);
  });

  it("es atómica: una fila inválida deja 0 insertadas e indica cuál", async () => {
    await como(ejecutivo);
    const r = await confirmarImportacion([fila(4), fila(5, { comentarios: "CLABE 002180701234567891" }), fila(6)]);
    expect(r).toMatchObject({ ok: false, filas: [5] });
    expect(await prospectosDe(ejecutivo)).toEqual([]);
  });

  it("la base también es atómica: un insert de arreglo con una fila que viola una restricción no deja ninguna", async () => {
    const cliente = await como(ejecutivo);
    const { error } = await cliente.from("prospectos").insert([fila(4).datos, { ...fila(5).datos, contacto: "12345" }, fila(6).datos]);
    expect(error?.code).toBe("23514");
    expect(await prospectosDe(ejecutivo)).toEqual([]);
  });

  it("un superior no importa a nombre de otro: un ejecutivo_id en la fila se rechaza y lo que importa queda a su nombre", async () => {
    await como(gerente);
    const ajena = { fila: 4, datos: { ...fila(4).datos, ejecutivo_id: ejecutivo.id } };
    const r = await confirmarImportacion([ajena]);
    expect(r.ok).toBe(false);
    expect(await prospectosDe(ejecutivo)).toEqual([]);

    expect(await confirmarImportacion([fila(7)])).toEqual({ ok: true, insertadas: 1 });
    expect((await prospectosDe(gerente)).map((f) => f.ejecutivo_id)).toEqual([gerente.id]);
    expect(await prospectosDe(ejecutivo)).toEqual([]);
  });

  it("un usuario desactivado a media sesión no importa nada", async () => {
    await como(ejecutivo);
    await admin.from("usuarios").update({ activo: false }).eq("id", ejecutivo.id);
    expect((await confirmarImportacion([fila(4)])).ok).toBe(false);
    expect(await prospectosDe(ejecutivo)).toEqual([]);
  });
});
