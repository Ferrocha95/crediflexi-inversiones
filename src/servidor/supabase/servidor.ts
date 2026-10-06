import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { configSupabase } from "./config";

/**
 * Cliente de Supabase para componentes de servidor, acciones y rutas, con la
 * sesión del usuario (cookies) y, por lo tanto, con RLS. Uno nuevo por
 * petición. El navegador nunca habla con Supabase: no hay cliente de navegador.
 *
 * Patrón oficial de @supabase/ssr: getAll/setAll sobre `await cookies()`.
 */
export async function crearClienteServidor() {
  // cookies() primero: marca la ruta como dinámica antes de leer la
  // configuración, así `next build` no la necesita.
  const almacen = await cookies();
  const { url, llavePublicable } = configSupabase();

  return createServerClient(url, llavePublicable, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(porGuardar) {
        try {
          for (const { name, value, options } of porGuardar) almacen.set(name, value, options);
        } catch {
          // Un componente de servidor no puede escribir cookies. Se ignora: el
          // proxy (src/servidor/supabase/proxy.ts) ya refresca la sesión.
        }
      },
    },
  });
}
