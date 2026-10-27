import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { RUTA_ACCESO } from "../aplicacion/acceso/rutas";
import { crearClienteServidor } from "./supabase/servidor";

export type Rol = "DIRECTOR_REGIONAL" | "GERENTE" | "EJECUTIVO";

export interface UsuarioSesion {
  readonly id: string;
  readonly authId: string;
  readonly nombre: string;
  readonly rol: Rol;
  readonly sucursal: { readonly id: string; readonly nombre: string };
}

export type Sesion =
  | { readonly tipo: "sin_sesion" }
  /** Sesión válida en Auth, pero sin fila en usuarios: inactivo (RLS no la devuelve). */
  | { readonly tipo: "inactivo" }
  | { readonly tipo: "activo"; readonly usuario: UsuarioSesion };

type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Ruta que cierra la sesión de un usuario inactivo. Está fuera del proxy, así que no hay bucle. */
export const RUTA_SALIR = `${RUTA_ACCESO}/salir`;

export const MENSAJE_ERROR_LECTURA =
  "No se pudo leer tu usuario en la base de datos. Vuelve a intentar en unos minutos; si sigue igual, avisa a quien administra el sistema.";

/**
 * Fila del usuario con la sesión del propio usuario, así que pasa por RLS:
 * un usuario inactivo no obtiene fila (privado.usuario_actual() lo excluye).
 */
export async function leerUsuario(cliente: Cliente, authId: string): Promise<UsuarioSesion | null> {
  const { data, error } = await cliente
    .from("usuarios")
    // Con la llave explícita: sucursales también se relaciona con usuarios por creado_por.
    .select("id, nombre, rol, sucursal:sucursales!usuarios_sucursal_id_fkey(id, nombre)")
    .eq("auth_id", authId)
    .maybeSingle();
  if (error) throw new Error(MENSAJE_ERROR_LECTURA);
  if (!data) return null;
  const fila = data as unknown as Omit<UsuarioSesion, "authId">;
  return { id: fila.id, authId, nombre: fila.nombre, rol: fila.rol, sucursal: fila.sucursal };
}

/** Estado de la sesión de esta petición (se calcula una vez por render). */
export const resolverSesion = cache(async (): Promise<Sesion> => {
  const cliente = await crearClienteServidor();
  const { data } = await cliente.auth.getClaims();
  const authId = data?.claims?.sub;
  if (!authId) return { tipo: "sin_sesion" };
  const usuario = await leerUsuario(cliente, authId);
  return usuario === null ? { tipo: "inactivo" } : { tipo: "activo", usuario };
});

/** Usuario con sesión y activo; null si no hay sesión o si está inactivo. */
export const usuarioActual = cache(async (): Promise<UsuarioSesion | null> => {
  const sesion = await resolverSesion();
  return sesion.tipo === "activo" ? sesion.usuario : null;
});

/**
 * Usuario activo o redirección. Sin sesión, a /acceso. Con sesión de un usuario
 * inactivo, a /acceso/salir, que cierra la sesión y muestra el aviso: un
 * componente de servidor no puede borrar cookies, y mandarlo directo a
 * /acceso dejaría la sesión viva.
 */
export async function exigirUsuario(): Promise<UsuarioSesion> {
  const sesion = await resolverSesion();
  if (sesion.tipo === "activo") return sesion.usuario;
  redirect(sesion.tipo === "inactivo" ? RUTA_SALIR : RUTA_ACCESO);
}
