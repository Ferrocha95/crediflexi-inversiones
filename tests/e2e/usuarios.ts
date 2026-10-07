// Usuarios sintéticos de las pruebas e2e (dominio @e2e.test), creados con la
// llave de servicio de Supabase local. La llave solo vive en memoria (sale de
// `supabase status`, igual que en las pruebas RLS) y nunca se imprime. El
// proyecto "limpieza" borra todo al final.

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
export async function crearUsuarioE2E(datos: { correo: string; nombre: string; rol: string }): Promise<UsuarioE2E> {
  const contrasena = generarContrasena();
  const cuenta = await admin().auth.admin.createUser({ email: datos.correo, password: contrasena, email_confirm: true });
  if (cuenta.error) falla(`crear la cuenta ${datos.correo}`, cuenta.error.message);
  const fila = await admin()
    .from("usuarios")
    .insert({ auth_id: cuenta.data.user.id, nombre: datos.nombre, rol: datos.rol, sucursal_id: await idSucursalE2E() })
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

/** Borra todos los usuarios @e2e.test, sus filas y la organización E2E. */
export async function borrarTodoE2E(): Promise<void> {
  const ids: string[] = [];
  for (let pagina = 1; ; pagina++) {
    const { data, error } = await admin().auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) falla("listar las cuentas E2E", error.message);
    for (const u of data.users) if (u.email?.toLowerCase().endsWith(DOMINIO_E2E)) ids.push(u.id);
    if (data.users.length < 1000) break;
  }
  if (ids.length > 0) {
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
  await expect(page).not.toHaveURL(/\/acceso/);
}
