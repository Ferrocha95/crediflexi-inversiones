// Usuarios sintéticos de las pruebas e2e (dominio @e2e.test), creados con la
// llave de servicio de Supabase local. La llave solo vive en memoria (sale de
// `supabase status`, igual que en las pruebas RLS) y nunca se imprime. El
// proyecto "limpieza" borra todo al final.

import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { generarContrasena } from "../../scripts/contrasena.mjs";
import { leerEntornoLocal, OPCIONES_CLIENTE } from "../rls/entorno";

export const DOMINIO_E2E = "@e2e.test";
export const ORGANIZACION_E2E = "Organización E2E";
export const SUCURSAL_E2E = "Sucursal E2E";

/** La sesión compartida se guarda FUERA del repositorio. */
export const RUTA_SESION = path.join(os.tmpdir(), "crediflexi-e2e", "sesion.json");

export const USUARIO_PRINCIPAL = {
  correo: `principal${DOMINIO_E2E}`,
  nombre: "Ejecutiva E2E Principal",
  rol: "EJECUTIVO",
  rolLegible: "Ejecutivo",
} as const;

export interface UsuarioE2E {
  readonly correo: string;
  readonly contrasena: string;
  readonly authId: string;
  readonly usuarioId: string;
}

let cliente: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (cliente === null) {
    const { url, llaveSecreta } = leerEntornoLocal();
    cliente = createClient(url, llaveSecreta, OPCIONES_CLIENTE);
  }
  return cliente;
}

function falla(accion: string, mensaje: string): never {
  throw new Error(`No se pudo ${accion}: ${mensaje}`);
}

/** Crea la organización y la sucursal E2E (el setup lo hace una vez, antes de las pruebas). */
export async function crearOrganizacionE2E(): Promise<void> {
  const org = await admin().from("organizaciones").insert({ nombre: ORGANIZACION_E2E }).select("id").single();
  if (org.error) falla("crear la organización E2E", org.error.message);
  const suc = await admin().from("sucursales").insert({ organizacion_id: org.data.id, nombre: SUCURSAL_E2E }).select("id").single();
  if (suc.error) falla("crear la sucursal E2E", suc.error.message);
}

async function idSucursalE2E(): Promise<string> {
  const { data, error } = await admin().from("sucursales").select("id").eq("nombre", SUCURSAL_E2E).single();
  if (error) falla("leer la sucursal E2E", error.message);
  return data.id as string;
}

/** Usuario activo con contraseña aleatoria (12 o más caracteres, minúscula, mayúscula y dígito). */
export async function crearUsuarioE2E(datos: { correo: string; nombre: string; rol: string; jefeId?: string }): Promise<UsuarioE2E> {
  const contrasena = generarContrasena();
  const cuenta = await admin().auth.admin.createUser({ email: datos.correo, password: contrasena, email_confirm: true });
  if (cuenta.error) falla(`crear la cuenta ${datos.correo}`, cuenta.error.message);
  const fila = await admin()
    .from("usuarios")
    .insert({ auth_id: cuenta.data.user.id, nombre: datos.nombre, rol: datos.rol, sucursal_id: await idSucursalE2E(), jefe_id: datos.jefeId ?? null })
    .select("id")
    .single();
  if (fila.error) falla(`crear el usuario ${datos.nombre}`, fila.error.message);
  return { correo: datos.correo, contrasena, authId: cuenta.data.user.id, usuarioId: fila.data.id as string };
}

/** Correo único para un usuario de una sola prueba. */
export const correoUnico = (prefijo: string) => `${prefijo}.${Date.now()}.${Math.floor(Math.random() * 1e6)}${DOMINIO_E2E}`;

export async function desactivarUsuario(usuarioId: string): Promise<void> {
  const { error } = await admin().from("usuarios").update({ activo: false }).eq("id", usuarioId);
  if (error) falla("desactivar el usuario", error.message);
}

/** Prospecto sintético a nombre de un usuario E2E (lo crea el administrador, con el ejecutivo explícito). */
export async function crearProspectoE2E(datos: {
  ejecutivoId: string;
  nombre: string;
  contacto: string;
  estatus: "INTERESADO" | "INTERMITENTE" | "NO_INTERESADO";
  seguimiento?: string | null;
  comentarios?: string;
}): Promise<string> {
  const { data, error } = await admin()
    .from("prospectos")
    .insert({
      ejecutivo_id: datos.ejecutivoId,
      nombre: datos.nombre,
      contacto: datos.contacto,
      estatus: datos.estatus,
      seguimiento: datos.seguimiento ?? null,
      comentarios: datos.comentarios ?? "",
    })
    .select("id")
    .single();
  if (error) falla(`crear el prospecto ${datos.nombre}`, error.message);
  return data.id as string;
}

/**
 * Elemento sintético de la Biblioteca en la organización E2E, creado por el
 * administrador (organización y autor explícitos). Si es archivo, sube al
 * bucket unos bytes PDF sintéticos.
 */
export async function crearElementoBibliotecaE2E(datos: {
  subidoPor: string;
  categoria: "HERRAMIENTAS" | "MULTIMEDIA" | "EMPRESA" | "CAPACITACION";
  nombre: string;
  descripcion?: string;
  enlace?: string;
  archivado?: boolean;
  /** Subcarpeta de la misma sección; sin ella, Sin carpeta. */
  carpetaId?: string;
}): Promise<string> {
  const org = await admin().from("organizaciones").select("id").eq("nombre", ORGANIZACION_E2E).single();
  if (org.error) falla("leer la organización E2E", org.error.message);
  const base = { organizacion_id: org.data.id, subido_por: datos.subidoPor, categoria: datos.categoria, nombre: datos.nombre, descripcion: datos.descripcion ?? "" };
  let fila: Record<string, unknown>;
  if (datos.enlace !== undefined) {
    fila = { ...base, tipo: "ENLACE", enlace: datos.enlace };
  } else {
    const ruta = `${org.data.id}/${randomUUID()}.pdf`;
    const bytes = new TextEncoder().encode(`%PDF-1.4
% Documento sintético E2E
%%EOF
`);
    const subida = await admin().storage.from("biblioteca").upload(ruta, bytes, { contentType: "application/pdf" });
    if (subida.error) falla(`subir el archivo ${datos.nombre}`, subida.error.message);
    fila = { ...base, tipo: "ARCHIVO", ruta, tipo_mime: "application/pdf", tamano_bytes: bytes.length };
  }
  if (datos.archivado) fila.archivado_en = new Date().toISOString();
  if (datos.carpetaId !== undefined) fila.carpeta_id = datos.carpetaId;
  const { data, error } = await admin().from("biblioteca").insert(fila).select("id").single();
  if (error) falla(`crear el elemento ${datos.nombre}`, error.message);
  return data.id as string;
}

/** Subcarpeta sintética de la Biblioteca en la organización E2E, creada por el administrador. */
export async function crearCarpetaBibliotecaE2E(datos: {
  creadoPor: string;
  categoria: "HERRAMIENTAS" | "MULTIMEDIA" | "EMPRESA" | "CAPACITACION";
  nombre: string;
}): Promise<string> {
  const org = await admin().from("organizaciones").select("id").eq("nombre", ORGANIZACION_E2E).single();
  if (org.error) falla("leer la organización E2E", org.error.message);
  const { data, error } = await admin()
    .from("biblioteca_carpetas")
    .insert({ organizacion_id: org.data.id, creado_por: datos.creadoPor, categoria: datos.categoria, nombre: datos.nombre })
    .select("id")
    .single();
  if (error) falla(`crear la carpeta ${datos.nombre}`, error.message);
  return data.id as string;
}

/** Ids de las filas de biblioteca o de biblioteca_carpetas con ese nombre (para limpiar lo creado desde la pantalla). */
export async function idsConNombreE2E(tabla: "biblioteca" | "biblioteca_carpetas", nombre: string): Promise<string[]> {
  const { data, error } = await admin().from(tabla).select("id").eq("nombre", nombre);
  if (error) falla(`buscar ${nombre} en ${tabla}`, error.message);
  return data.map((f) => f.id as string);
}

/**
 * Borra, con el administrador, las carpetas con esos ids. Van DESPUÉS de sus
 * elementos (biblioteca.carpeta_id es "on delete restrict").
 */
export async function borrarCarpetasBibliotecaE2E(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await admin().from("biblioteca_carpetas").delete().in("id", [...ids]);
  if (error) falla("borrar las carpetas de biblioteca E2E", error.message);
}

/** Cuántas de esas carpetas siguen existiendo. */
export async function restosCarpetasE2E(ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const r = await admin().from("biblioteca_carpetas").select("id", { count: "exact", head: true }).in("id", [...ids]);
  if (r.error) falla("contar las carpetas de biblioteca E2E", r.error.message);
  return r.count ?? -1;
}

/** Rutas en el bucket de los elementos con esos ids (los enlaces no tienen). */
async function rutasDeElementos(ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data, error } = await admin().from("biblioteca").select("ruta").in("id", [...ids]);
  if (error) falla("leer las rutas de la biblioteca E2E", error.message);
  return data.map((f) => f.ruta as string | null).filter((r): r is string => r !== null);
}

/**
 * Borra, con el administrador, las filas de biblioteca con esos ids y sus
 * objetos del bucket. Devuelve las rutas borradas, para comprobar después que
 * no quedó ninguna.
 */
export async function borrarElementosBibliotecaE2E(ids: readonly string[]): Promise<string[]> {
  const rutas = await rutasDeElementos(ids);
  if (ids.length > 0) {
    const { error } = await admin().from("biblioteca").delete().in("id", [...ids]);
    if (error) falla("borrar las filas de biblioteca E2E", error.message);
  }
  if (rutas.length > 0) {
    const { error } = await admin().storage.from("biblioteca").remove(rutas);
    if (error) falla("borrar los objetos de biblioteca E2E", error.message);
  }
  return rutas;
}

/** Cuántas de esas filas y de esos objetos siguen existiendo. */
export async function restosBibliotecaE2E(ids: readonly string[], rutas: readonly string[]): Promise<{ filas: number; objetos: number }> {
  let filas = 0;
  if (ids.length > 0) {
    const r = await admin().from("biblioteca").select("id", { count: "exact", head: true }).in("id", [...ids]);
    if (r.error) falla("contar las filas de biblioteca E2E", r.error.message);
    filas = r.count ?? -1;
  }
  let objetos = 0;
  for (const ruta of rutas) {
    const carpeta = ruta.slice(0, ruta.indexOf("/"));
    const nombre = ruta.slice(ruta.indexOf("/") + 1);
    const lista = await admin().storage.from("biblioteca").list(carpeta, { search: nombre });
    if (lista.error) falla("listar los objetos de biblioteca E2E", lista.error.message);
    objetos += lista.data.filter((o) => o.name === nombre).length;
  }
  return { filas, objetos };
}

/** Ids de Auth de todas las cuentas @e2e.test. */
async function cuentasE2E(): Promise<string[]> {
  const ids: string[] = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin().auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) falla("listar las cuentas E2E", error.message);
    for (const u of data.users) if (u.email?.toLowerCase().endsWith(DOMINIO_E2E)) ids.push(u.id);
    if (data.users.length < 1000) break;
  }
  return ids;
}

/** Id de la fila de usuarios de una cuenta E2E, o null si no existe. */
export async function idUsuarioE2E(correo: string): Promise<string | null> {
  const { data: cuentas, error: errorCuentas } = await admin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (errorCuentas) falla("listar las cuentas E2E", errorCuentas.message);
  const cuenta = cuentas.users.find((u) => u.email?.toLowerCase() === correo.toLowerCase());
  if (cuenta === undefined) return null;
  const { data, error } = await admin().from("usuarios").select("id").eq("auth_id", cuenta.id).maybeSingle();
  if (error) falla("leer el usuario E2E", error.message);
  return (data?.id as string | undefined) ?? null;
}

/** Cuánto queda de lo E2E: cuentas, filas de usuarios, sus prospectos y la organización. */
export async function contarRestosE2E(idsUsuarios: readonly string[]): Promise<{ cuentas: number; usuarios: number; prospectos: number; organizaciones: number }> {
  const cuentas = (await cuentasE2E()).length;
  const u = await admin().from("usuarios").select("id", { count: "exact", head: true }).in("id", [...idsUsuarios]);
  const p = await admin().from("prospectos").select("id", { count: "exact", head: true }).in("ejecutivo_id", [...idsUsuarios]);
  const o = await admin().from("organizaciones").select("id", { count: "exact", head: true }).eq("nombre", ORGANIZACION_E2E);
  for (const r of [u, p, o]) if (r.error) falla("contar los restos E2E", r.error.message);
  return { cuentas, usuarios: u.count ?? -1, prospectos: p.count ?? -1, organizaciones: o.count ?? -1 };
}

/** Ids de las filas de usuarios de todas las cuentas E2E. */
export async function idsUsuariosE2E(): Promise<string[]> {
  const ids = await cuentasE2E();
  if (ids.length === 0) return [];
  const { data, error } = await admin().from("usuarios").select("id").in("auth_id", ids);
  if (error) falla("leer los usuarios E2E", error.message);
  return data.map((u) => u.id as string);
}

/**
 * Filas de biblioteca y objetos del bucket de la organización E2E, y luego sus
 * carpetas: van antes que los usuarios y la organización (biblioteca.subido_por,
 * biblioteca.organizacion_id, biblioteca.carpeta_id,
 * biblioteca_carpetas.creado_por y biblioteca_carpetas.organizacion_id son
 * "on delete restrict").
 */
async function borrarBibliotecaE2E(): Promise<void> {
  const orgs = await admin().from("organizaciones").select("id").eq("nombre", ORGANIZACION_E2E);
  if (orgs.error) falla("buscar la organización E2E", orgs.error.message);
  for (const { id } of orgs.data) {
    const filas = await admin().from("biblioteca").delete().eq("organizacion_id", id);
    if (filas.error) falla("borrar la biblioteca E2E", filas.error.message);
    for (;;) {
      const lista = await admin().storage.from("biblioteca").list(id as string, { limit: 1000 });
      if (lista.error) falla("listar los archivos E2E", lista.error.message);
      if (lista.data.length === 0) break;
      const borrar = await admin().storage.from("biblioteca").remove(lista.data.map((o) => `${id}/${o.name}`));
      if (borrar.error) falla("borrar los archivos E2E", borrar.error.message);
      if (borrar.data.length === 0) falla("borrar los archivos E2E", "no se borró ninguno");
    }
    const carpetas = await admin().from("biblioteca_carpetas").delete().eq("organizacion_id", id);
    if (carpetas.error) falla("borrar las carpetas de biblioteca E2E", carpetas.error.message);
  }
}

/** Cuántas filas de biblioteca quedan de la organización E2E. */
export async function contarBibliotecaE2E(): Promise<number> {
  const orgs = await admin().from("organizaciones").select("id").eq("nombre", ORGANIZACION_E2E);
  if (orgs.error) falla("buscar la organización E2E", orgs.error.message);
  if (orgs.data.length === 0) return 0;
  const r = await admin().from("biblioteca").select("id", { count: "exact", head: true }).in("organizacion_id", orgs.data.map((o) => o.id as string));
  if (r.error) falla("contar la biblioteca E2E", r.error.message);
  return r.count ?? -1;
}

/**
 * Borra, en este orden: los elementos de la biblioteca E2E y sus objetos del
 * bucket, luego sus carpetas, luego los usuarios @e2e.test (con sus prospectos)
 * y la organización E2E.
 */
export async function borrarTodoE2E(): Promise<void> {
  await borrarBibliotecaE2E();
  const ids = await cuentasE2E();
  if (ids.length > 0) {
    // prospectos.ejecutivo_id es "on delete restrict": se borran antes que los usuarios.
    const usuarios = await admin().from("usuarios").select("id").in("auth_id", ids);
    if (usuarios.error) falla("leer los usuarios E2E", usuarios.error.message);
    const idsUsuarios = usuarios.data.map((u) => u.id as string);
    if (idsUsuarios.length > 0) {
      const p = await admin().from("prospectos").delete().in("ejecutivo_id", idsUsuarios);
      if (p.error) falla("borrar los prospectos E2E", p.error.message);
      const j = await admin().from("usuarios").update({ jefe_id: null }).in("id", idsUsuarios);
      if (j.error) falla("soltar los jefes E2E", j.error.message);
    }
    const filas = await admin().from("usuarios").delete().in("auth_id", ids);
    if (filas.error) falla("borrar los usuarios E2E", filas.error.message);
    for (const id of ids) {
      const { error } = await admin().auth.admin.deleteUser(id);
      if (error) falla("borrar una cuenta E2E", error.message);
    }
  }
  const orgs = await admin().from("organizaciones").select("id").eq("nombre", ORGANIZACION_E2E);
  if (orgs.error) falla("buscar la organización E2E", orgs.error.message);
  for (const { id } of orgs.data) {
    const s = await admin().from("sucursales").delete().eq("organizacion_id", id);
    if (s.error) falla("borrar la sucursal E2E", s.error.message);
    const o = await admin().from("organizaciones").delete().eq("id", id);
    if (o.error) falla("borrar la organización E2E", o.error.message);
  }
}

/** Entra por la pantalla de acceso y espera a salir de ella. */
export async function entrar(page: Page, correo: string, contrasena: string, ruta = "/acceso"): Promise<void> {
  await page.goto(ruta);
  await page.getByLabel("Correo").fill(correo);
  await page.getByLabel("Contraseña").fill(contrasena);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Con varias pruebas iniciando sesión a la vez, Auth puede tardar más de los 5 s por omisión.
  await expect(page).not.toHaveURL(/\/acceso/, { timeout: 20_000 });
}
