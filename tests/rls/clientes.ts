import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import { correoDe, type ClaveUsuario } from "./fixtures";

function clienteSinSesion(): SupabaseClient {
  const { url, llavePublicable } = inject("rls");
  return createClient(url, llavePublicable, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// Cliente sin sesión: consulta como el rol anon.
export function comoAnonimo(): SupabaseClient {
  return clienteSinSesion();
}

// Inicia sesión como el usuario sintético indicado y devuelve un cliente que
// consulta con sus permisos (rol authenticated, sujeto a RLS).
export async function comoUsuario(clave: ClaveUsuario): Promise<SupabaseClient> {
  const { contrasena } = inject("rls");
  const cliente = clienteSinSesion();

  const { error } = await cliente.auth.signInWithPassword({
    email: correoDe(clave),
    password: contrasena,
  });
  if (error) {
    throw new Error(
      `No se pudo iniciar sesión como ${clave}: ${error.message}. ` +
        "Revisa que tests/rls/setup-global.ts haya creado los datos de prueba.",
    );
  }

  return cliente;
}
