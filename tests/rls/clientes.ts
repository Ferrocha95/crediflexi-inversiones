import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import { OPCIONES_CLIENTE } from "./entorno";
import { correoDe, type ClaveUsuario } from "./fixtures";

function clienteSinSesion(): SupabaseClient {
  const { url, llavePublicable } = inject("rls");
  return createClient(url, llavePublicable, OPCIONES_CLIENTE);
}

// Cliente sin sesión: consulta como el rol anon.
export function comoAnonimo(): SupabaseClient {
  return clienteSinSesion();
}

// Inicia sesión con correo y contraseña y devuelve un cliente que consulta con
// los permisos de esa persona (rol authenticated, sujeto a RLS).
export async function iniciarSesion(
  correo: string,
  contrasena: string,
): Promise<SupabaseClient> {
  const cliente = clienteSinSesion();
  const { error } = await cliente.auth.signInWithPassword({ email: correo, password: contrasena });
  if (error) {
    throw new Error(
      `No se pudo iniciar sesión como ${correo}: ${error.message}. ` +
        "Revisa que la cuenta de prueba se haya creado.",
    );
  }
  return cliente;
}

// Inicia sesión como el usuario sintético base indicado (E1, G1, D1, ...).
export async function comoUsuario(clave: ClaveUsuario): Promise<SupabaseClient> {
  const { contrasena } = inject("rls");
  return iniciarSesion(correoDe(clave), contrasena);
}
