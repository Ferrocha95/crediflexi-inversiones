// Preparación global del proyecto "rls" de Vitest.
//
// 1. Lee URL y llaves de Supabase local con entorno.ts (sin imprimirlas y
//    abortando si la URL no es local).
// 2. Limpia restos de corridas anteriores, crea los datos sintéticos y toma
//    una foto de ellos.
// 3. Al terminar, comprueba que los datos base siguen idénticos a la foto,
//    vuelve a limpiar y verifica que no quedó nada.
//
// La llave secreta nunca se pasa a las pruebas por provide/inject: a ellas
// solo llegan la URL, la llave publicable, la contraseña sintética, los ids y
// la foto. Las pruebas que necesitan administrador la leen con admin.ts.

import { isDeepStrictEqual } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generarContrasena } from "../../scripts/contrasena.mjs";
import type { TestProject } from "vitest/node";
import { OPCIONES_CLIENTE, leerEntornoLocal } from "./entorno";
import {
  DOMINIO_PRUEBAS,
  MARCA,
  ORGANIZACIONES,
  PROSPECTOS,
  SUCURSALES,
  USUARIOS,
  correoDe,
  type ClaveOrganizacion,
  type ClaveProspecto,
  type ClaveSucursal,
  type ClaveUsuario,
} from "./fixtures";
import { tomarFotoBase, type FotoBase, type IdsDatos } from "./foto";

export interface DatosRls extends IdsDatos {
  url: string;
  llavePublicable: string;
  contrasena: string;
  fotoBase: FotoBase;
}

declare module "vitest" {
  export interface ProvidedContext {
    rls: DatosRls;
  }
}

function falla(accion: string, mensaje: string): never {
  throw new Error(`No se pudo ${accion}: ${mensaje}`);
}

async function listarIdsAuthDePrueba(admin: SupabaseClient): Promise<string[]> {
  const ids: string[] = [];
  const porPagina = 1000;
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page: pagina,
      perPage: porPagina,
    });
    if (error) falla("listar las cuentas de prueba", error.message);
    for (const u of data.users) {
      if (u.email?.toLowerCase().endsWith(DOMINIO_PRUEBAS)) ids.push(u.id);
    }
    if (data.users.length < porPagina) return ids;
  }
}

async function listarIdsOrganizacionesDePrueba(
  admin: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await admin
    .from("organizaciones")
    .select("id")
    .like("nombre", `%${MARCA}`);
  if (error) falla("listar las organizaciones de prueba", error.message);
  return data.map((o) => o.id as string);
}

// Borra solo lo sintético: cuentas con correo @rls.test, sus filas en usuarios
// y sus prospectos, y las organizaciones, sucursales y prospectos marcados con
// MARCA.
async function limpiar(admin: SupabaseClient): Promise<void> {
  const idsAuth = await listarIdsAuthDePrueba(admin);
  const idsOrganizaciones = await listarIdsOrganizacionesDePrueba(admin);

  let idsSucursales: string[] = [];
  if (idsOrganizaciones.length > 0) {
    const { data, error } = await admin
      .from("sucursales")
      .select("id")
      .in("organizacion_id", idsOrganizaciones);
    if (error) falla("listar las sucursales de prueba", error.message);
    idsSucursales = data.map((s) => s.id as string);
  }

  // biblioteca.organizacion_id y biblioteca.subido_por son "on delete
  // restrict": sus filas y sus objetos del bucket se borran antes.
  await limpiarBiblioteca(admin, idsOrganizaciones);

  // prospectos.ejecutivo_id es "on delete restrict": los prospectos de los
  // usuarios de prueba se borran antes que ellos.
  const idsUsuariosDePrueba = new Set<string>();
  for (const [columna, ids] of [
    ["auth_id", idsAuth],
    ["sucursal_id", idsSucursales],
  ] as const) {
    if (ids.length === 0) continue;
    const { data, error } = await admin.from("usuarios").select("id").in(columna, ids);
    if (error) falla("listar los usuarios de prueba", error.message);
    for (const u of data) idsUsuariosDePrueba.add(u.id as string);
  }
  if (idsUsuariosDePrueba.size > 0) {
    const { error } = await admin.from("prospectos").delete().in("ejecutivo_id", [...idsUsuariosDePrueba]);
    if (error) falla("borrar los prospectos de prueba", error.message);
  }
  {
    const { error } = await admin.from("prospectos").delete().like("nombre", `%${MARCA}`);
    if (error) falla("borrar los prospectos marcados", error.message);
  }

  // usuarios.jefe_id es "on delete restrict": primero se sueltan los jefes.
  for (const [columna, ids] of [
    ["auth_id", idsAuth],
    ["sucursal_id", idsSucursales],
  ] as const) {
    if (ids.length === 0) continue;
    const soltar = await admin
      .from("usuarios")
      .update({ jefe_id: null })
      .in(columna, ids);
    if (soltar.error) falla("soltar a los jefes de prueba", soltar.error.message);
    const borrar = await admin.from("usuarios").delete().in(columna, ids);
    if (borrar.error) falla("borrar los usuarios de prueba", borrar.error.message);
  }

  if (idsSucursales.length > 0) {
    const { error } = await admin.from("sucursales").delete().in("id", idsSucursales);
    if (error) falla("borrar las sucursales de prueba", error.message);
  }
  if (idsOrganizaciones.length > 0) {
    const { error } = await admin
      .from("organizaciones")
      .delete()
      .in("id", idsOrganizaciones);
    if (error) falla("borrar las organizaciones de prueba", error.message);
  }

  // usuarios.auth_id es "on delete restrict": las cuentas se borran al final.
  for (const id of idsAuth) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) falla("borrar una cuenta de prueba", error.message);
  }
}

// Filas de biblioteca y objetos del bucket bajo el prefijo de cada
// organización de prueba.
async function limpiarBiblioteca(admin: SupabaseClient, idsOrganizaciones: string[]): Promise<void> {
  if (idsOrganizaciones.length === 0) return;
  const { error } = await admin.from("biblioteca").delete().in("organizacion_id", idsOrganizaciones);
  if (error) falla("borrar las filas de biblioteca de prueba", error.message);
  for (const organizacion of idsOrganizaciones) {
    for (;;) {
      const lista = await admin.storage.from("biblioteca").list(organizacion, { limit: 1000 });
      if (lista.error) falla("listar los objetos de prueba del bucket", lista.error.message);
      if (lista.data.length === 0) break;
      const borrar = await admin.storage
        .from("biblioteca")
        .remove(lista.data.map((o) => `${organizacion}/${o.name}`));
      if (borrar.error) falla("borrar los objetos de prueba del bucket", borrar.error.message);
      if (borrar.data.length === 0) falla("borrar los objetos de prueba del bucket", "no se borró ninguno");
    }
  }
}

async function verificarLimpio(admin: SupabaseClient): Promise<void> {
  const cuentas = await listarIdsAuthDePrueba(admin);
  const organizaciones = await listarIdsOrganizacionesDePrueba(admin);
  const sucursales = await admin
    .from("sucursales")
    .select("id", { count: "exact", head: true })
    .like("nombre", `%${MARCA}`);
  if (sucursales.error) falla("revisar las sucursales de prueba", sucursales.error.message);
  const prospectos = await admin
    .from("prospectos")
    .select("id", { count: "exact", head: true })
    .like("nombre", `%${MARCA}`);
  if (prospectos.error) falla("revisar los prospectos de prueba", prospectos.error.message);

  if (
    cuentas.length > 0 ||
    organizaciones.length > 0 ||
    (sucursales.count ?? 0) > 0 ||
    (prospectos.count ?? 0) > 0
  ) {
    throw new Error(
      `La limpieza de datos de prueba quedó incompleta: ${cuentas.length} cuentas ${DOMINIO_PRUEBAS}, ` +
        `${organizaciones.length} organizaciones, ${sucursales.count ?? 0} sucursales y ` +
        `${prospectos.count ?? 0} prospectos ${MARCA}. ` +
        "Vuelve a correr npm run test:rls o reinicia la base con npm run db:reset.",
    );
  }
}

async function crearDatos(
  admin: SupabaseClient,
  contrasena: string,
): Promise<IdsDatos> {
  const idsOrganizaciones = {} as Record<ClaveOrganizacion, string>;
  for (const o of ORGANIZACIONES) {
    const { data, error } = await admin
      .from("organizaciones")
      .insert({ nombre: o.nombre })
      .select("id")
      .single();
    if (error) falla(`crear la organización ${o.clave}`, error.message);
    idsOrganizaciones[o.clave] = data.id as string;
  }

  const idsSucursales = {} as Record<ClaveSucursal, string>;
  for (const s of SUCURSALES) {
    const { data, error } = await admin
      .from("sucursales")
      .insert({ organizacion_id: idsOrganizaciones[s.organizacion], nombre: s.nombre })
      .select("id")
      .single();
    if (error) falla(`crear la sucursal ${s.clave}`, error.message);
    idsSucursales[s.clave] = data.id as string;
  }

  const idsUsuarios = {} as Record<ClaveUsuario, string>;
  for (const u of USUARIOS) {
    const cuenta = await admin.auth.admin.createUser({
      email: correoDe(u.clave),
      password: contrasena,
      email_confirm: true,
    });
    if (cuenta.error) falla(`crear la cuenta de ${u.clave}`, cuenta.error.message);

    const { data, error } = await admin
      .from("usuarios")
      .insert({
        auth_id: cuenta.data.user.id,
        nombre: u.nombre,
        rol: u.rol,
        sucursal_id: idsSucursales[u.sucursal],
        jefe_id: u.jefe ? idsUsuarios[u.jefe] : null,
        activo: u.activo,
      })
      .select("id")
      .single();
    if (error) falla(`crear el usuario ${u.clave}`, error.message);
    idsUsuarios[u.clave] = data.id as string;
  }

  // Con ejecutivo_id explícito: el valor por omisión (el usuario actual) no
  // existe para el administrador.
  const idsProspectos = {} as Record<ClaveProspecto, string>;
  for (const p of PROSPECTOS) {
    const { data, error } = await admin
      .from("prospectos")
      .insert({
        ejecutivo_id: idsUsuarios[p.ejecutivo],
        nombre: p.nombre,
        contacto: p.contacto,
        estatus: p.estatus,
        seguimiento: p.seguimiento,
        archivado_en: p.archivado ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) falla(`crear el prospecto ${p.clave}`, error.message);
    idsProspectos[p.clave] = data.id as string;
  }

  return { idsOrganizaciones, idsSucursales, idsUsuarios, idsProspectos };
}

export default async function setup(project: TestProject) {
  const entorno = leerEntornoLocal();

  const admin = createClient(entorno.url, entorno.llaveSecreta, OPCIONES_CLIENTE);

  // Contraseña sintética distinta en cada corrida; nunca se imprime.
  const contrasena = generarContrasena();

  await limpiar(admin);
  await verificarLimpio(admin);

  let ids: IdsDatos;
  let fotoBase: FotoBase;
  try {
    ids = await crearDatos(admin, contrasena);
    fotoBase = await tomarFotoBase(admin, ids);
  } catch (error) {
    await limpiar(admin);
    throw error;
  }

  project.provide("rls", {
    url: entorno.url,
    llavePublicable: entorno.llavePublicable,
    contrasena,
    fotoBase,
    ...ids,
  });

  return async () => {
    try {
      await comprobarDatosBaseIntactos(admin, ids, fotoBase);
    } finally {
      await limpiar(admin);
      await verificarLimpio(admin);
    }
  };
}

// Comprobación final: los datos base deben seguir exactamente como se crearon.
async function comprobarDatosBaseIntactos(
  admin: SupabaseClient,
  ids: IdsDatos,
  inicial: FotoBase,
): Promise<void> {
  const final = await tomarFotoBase(admin, ids);
  const distintas = (Object.keys(inicial) as (keyof FotoBase)[]).filter(
    (parte) => !isDeepStrictEqual(inicial[parte], final[parte]),
  );
  if (distintas.length > 0) {
    throw new Error(
      `Comprobación final fallida: los datos base cambiaron durante las pruebas (${distintas.join(", ")}). ` +
        "Alguna prueba modificó a E1–E6, D1, D2, G1, G2, sus sucursales, organizaciones o prospectos base.",
    );
  }
  console.log(
    `Comprobación final: los datos base quedaron idénticos a como se crearon ` +
      `(${final.organizaciones.length} organizaciones, ${final.sucursales.length} sucursales, ` +
      `${final.usuarios.length} usuarios, ${final.prospectos.length} prospectos, ${final.cuentas.length} cuentas).`,
  );
}
