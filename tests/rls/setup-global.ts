// Preparación global del proyecto "rls" de Vitest.
//
// 1. Lee URL y llaves de `supabase status -o json` sin imprimirlas nunca.
// 2. Aborta si la URL no apunta a Supabase local.
// 3. Limpia restos de corridas anteriores, crea los datos sintéticos y, al
//    terminar, vuelve a limpiar y verifica que no quedó nada.
//
// La llave secreta (service_role) solo vive en este archivo: a las pruebas
// únicamente se les pasa la URL, la llave publicable y la contraseña sintética.

import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TestProject } from "vitest/node";
import {
  DOMINIO_PRUEBAS,
  MARCA,
  ORGANIZACIONES,
  SUCURSALES,
  USUARIOS,
  correoDe,
  type ClaveOrganizacion,
  type ClaveSucursal,
  type ClaveUsuario,
} from "./fixtures";

export interface IdsDatos {
  idsOrganizaciones: Record<ClaveOrganizacion, string>;
  idsSucursales: Record<ClaveSucursal, string>;
  idsUsuarios: Record<ClaveUsuario, string>;
}

export interface DatosRls extends IdsDatos {
  url: string;
  llavePublicable: string;
  contrasena: string;
}

declare module "vitest" {
  export interface ProvidedContext {
    rls: DatosRls;
  }
}

const MENSAJE_NO_CORRE =
  "Supabase local no está corriendo. Ejecuta: npm run db:start";

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1"]);

interface EntornoLocal {
  url: string;
  llavePublicable: string;
  llaveSecreta: string;
}

function leerEntornoLocal(): EntornoLocal {
  let salida: string;
  try {
    // stdio en "pipe": nada de la salida (que incluye llaves) llega a la consola.
    salida = execSync("npx supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    // No se reenvía el error original: podría contener la salida del comando.
    throw new Error(MENSAJE_NO_CORRE);
  }

  let estado: Record<string, unknown>;
  try {
    estado = JSON.parse(salida) as Record<string, unknown>;
  } catch {
    throw new Error(MENSAJE_NO_CORRE);
  }

  const texto = (clave: string): string | undefined => {
    const valor = estado[clave];
    return typeof valor === "string" && valor !== "" ? valor : undefined;
  };

  const url = texto("API_URL");
  const llavePublicable = texto("PUBLISHABLE_KEY") ?? texto("ANON_KEY");
  const llaveSecreta = texto("SECRET_KEY") ?? texto("SERVICE_ROLE_KEY");

  if (!url) {
    throw new Error(MENSAJE_NO_CORRE);
  }
  if (!llavePublicable || !llaveSecreta) {
    throw new Error(
      "No se encontraron las llaves de Supabase local en `supabase status`. " +
        "Revisa que Supabase local esté completo con: npm run db:status",
    );
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(
      "La URL de Supabase que reporta `supabase status` no es válida. " +
        "Revisa la instalación local con: npm run db:status",
    );
  }
  if (!HOSTS_LOCALES.has(host)) {
    throw new Error(
      "Las pruebas de RLS solo corren contra Supabase local (localhost o 127.0.0.1), " +
        "pero la URL apunta a otro servidor. Se abortó para no tocar un proyecto en la nube.",
    );
  }

  return { url, llavePublicable, llaveSecreta };
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

// Borra solo lo sintético: cuentas con correo @rls.test, sus filas en usuarios,
// y las organizaciones y sucursales marcadas con MARCA.
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

async function verificarLimpio(admin: SupabaseClient): Promise<void> {
  const cuentas = await listarIdsAuthDePrueba(admin);
  const organizaciones = await listarIdsOrganizacionesDePrueba(admin);
  const sucursales = await admin
    .from("sucursales")
    .select("id", { count: "exact", head: true })
    .like("nombre", `%${MARCA}`);
  if (sucursales.error) falla("revisar las sucursales de prueba", sucursales.error.message);

  if (cuentas.length > 0 || organizaciones.length > 0 || (sucursales.count ?? 0) > 0) {
    throw new Error(
      `La limpieza de datos de prueba quedó incompleta: ${cuentas.length} cuentas ${DOMINIO_PRUEBAS}, ` +
        `${organizaciones.length} organizaciones y ${sucursales.count ?? 0} sucursales ${MARCA}. ` +
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

  return { idsOrganizaciones, idsSucursales, idsUsuarios };
}

export default async function setup(project: TestProject) {
  const entorno = leerEntornoLocal();

  const admin = createClient(entorno.url, entorno.llaveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Contraseña sintética distinta en cada corrida; nunca se imprime.
  const contrasena = randomBytes(24).toString("base64url");

  await limpiar(admin);
  await verificarLimpio(admin);

  let ids: IdsDatos;
  try {
    ids = await crearDatos(admin, contrasena);
  } catch (error) {
    await limpiar(admin);
    throw error;
  }

  project.provide("rls", {
    url: entorno.url,
    llavePublicable: entorno.llavePublicable,
    contrasena,
    ...ids,
  });

  return async () => {
    await limpiar(admin);
    await verificarLimpio(admin);
  };
}
