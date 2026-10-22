import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { configSupabase } from "./config";
import { llegaPorHttps, opcionesDeCookie } from "./proxy";

/**
 * Cliente de Supabase para componentes de servidor, acciones y rutas, con la
 * sesión del usuario (cookies) y, por lo tanto, con RLS. Uno nuevo por
 * petición. El navegador nunca habla con Supabase: no hay cliente de navegador.
 *
 * Patrón oficial de @supabase/ssr: getAll/setAll sobre `await cookies()`.
 * Las cookies salen con las opciones fijas de opcionesDeCookie (HttpOnly,
 * SameSite=Lax, Path=/ y Secure solo con HTTPS); aquí no hay URL de la
 * petición, así que el protocolo sale de x-forwarded-proto.
 */
export async function crearClienteServidor() {
  // cookies() primero: marca la ruta como dinámica antes de leer la
  // configuración, así `next build` no la necesita.
  const almacen = await cookies();
  const https = llegaPorHttps("", (await headers()).get("x-forwarded-proto"));
  const { url, llavePublicable } = configSupabase();

  return createServerClient(url, llavePublicable, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(porGuardar) {
        try {
          for (const { name, value, options } of porGuardar) almacen.set(name, value, opcionesDeCookie(options, https));
        } catch {
          // Un componente de servidor no puede escribir cookies. Se ignora: el
          // proxy (src/servidor/supabase/proxy.ts) ya refresca la sesión.
        }
      },
    },
  });
}
