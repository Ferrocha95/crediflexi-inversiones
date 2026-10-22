"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MENSAJES_ACCESO, mensajeDeErrorAuth } from "../../aplicacion/acceso/mensajes";
import { siguienteSeguro } from "../../aplicacion/acceso/siguiente";
import { hostAutorizado, MENSAJE_HOST_NO_AUTORIZADO } from "../../servidor/guardiaHost";
import { leerUsuario, MENSAJE_ERROR_LECTURA } from "../../servidor/sesion";
import { crearClienteServidor } from "../../servidor/supabase/servidor";

export interface EstadoAcceso {
  readonly error: string | null;
  /** El correo escrito, para no tener que repetirlo tras un error. La contraseña nunca vuelve. */
  readonly correo?: string;
}

const LARGO_MAXIMO = 320;

function texto(datos: FormData, campo: string): string {
  const valor = datos.get(campo);
  return typeof valor === "string" ? valor : "";
}

/**
 * Entrar con correo y contraseña. Repite el guardia de host del proxy. Después
 * de signInWithPassword confirma la sesión con getClaims() y lee la fila del
 * usuario con RLS: si no hay fila (inactivo), cierra la sesión en ese momento.
 * Solo redirige a un `siguiente` relativo y local. No registra nada de lo
 * recibido.
 */
export async function iniciarSesion(_previo: EstadoAcceso, datos: FormData): Promise<EstadoAcceso> {
  if (!hostAutorizado((await headers()).get("host"))) return { error: MENSAJE_HOST_NO_AUTORIZADO };

  const correo = texto(datos, "correo").trim();
  const contrasena = texto(datos, "contrasena");
  const fallo = (error: string): EstadoAcceso => ({ error, correo: correo.slice(0, LARGO_MAXIMO) });
  if (correo === "" || contrasena === "") return fallo(MENSAJES_ACCESO.faltanDatos);
  if (correo.length > LARGO_MAXIMO || contrasena.length > LARGO_MAXIMO) return fallo(MENSAJES_ACCESO.credenciales);

  const cliente = await crearClienteServidor();
  const { error } = await cliente.auth.signInWithPassword({ email: correo, password: contrasena });
  if (error) return fallo(mensajeDeErrorAuth(error));

  const { data } = await cliente.auth.getClaims();
  const authId = data?.claims?.sub;
  if (!authId) return fallo(MENSAJES_ACCESO.sinServicio);

  let usuario;
  try {
    usuario = await leerUsuario(cliente, authId);
  } catch {
    await cliente.auth.signOut();
    return fallo(MENSAJE_ERROR_LECTURA);
  }
  if (usuario === null) {
    await cliente.auth.signOut();
    return fallo(MENSAJES_ACCESO.inactivo);
  }

  redirect(siguienteSeguro(texto(datos, "siguiente")));
}

/**
 * Salir. Repite el guardia de host y solo llama a signOut si hay sesión. No
 * redirige: el botón (src/componentes/estructura/Usuario.tsx) navega a
 * /acceso con una carga completa, que además limpia lo que el navegador tenía
 * en memoria, y lo hace aunque esta acción falle porque la sesión ya expiró.
 */
export async function cerrarSesion(): Promise<void> {
  if (!hostAutorizado((await headers()).get("host"))) throw new Error(MENSAJE_HOST_NO_AUTORIZADO);

  const cliente = await crearClienteServidor();
  const { data } = await cliente.auth.getClaims();
  if (data?.claims) await cliente.auth.signOut();
}
