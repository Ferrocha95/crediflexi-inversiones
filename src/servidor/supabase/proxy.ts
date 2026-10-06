import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RUTA_ACCESO, rutaSinRefresco } from "../../aplicacion/acceso/rutas";
import { configSupabase } from "./config";

/**
 * Refresca la sesión en cada petición y manda a /acceso a quien no la tiene.
 * Adaptado del ejemplo oficial de Supabase para Next 16 (proxy.ts):
 * getClaims() justo después de crear el cliente (en el servidor nunca se lee
 * la sesión sin verificar su firma) y la respuesta lleva las cookies y los
 * encabezados de caché que da setAll. /acceso, los estáticos de Next, el
 * ícono y public quedan fuera (ver rutaSinRefresco).
 *
 * El proxy no basta como autorización: cada acción y cada página vuelve a
 * revisar la sesión (src/servidor/sesion.ts).
 */
export async function actualizarSesion(request: NextRequest): Promise<NextResponse> {
  if (rutaSinRefresco(request.nextUrl.pathname)) return NextResponse.next();

  const { url, llavePublicable } = configSupabase();
  let respuesta = NextResponse.next({ request });
  const encabezadosDeCache: Record<string, string> = {};

  const supabase = createServerClient(url, llavePublicable, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(porGuardar, encabezados) {
        for (const { name, value } of porGuardar) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of porGuardar) respuesta.cookies.set(name, value, options);
        Object.assign(encabezadosDeCache, encabezados);
        for (const [clave, valor] of Object.entries(encabezadosDeCache)) respuesta.headers.set(clave, valor);
      },
    },
  });

  // Nada entre createServerClient y getClaims: así lo pide la documentación
  // de Supabase para no cerrar sesiones al azar.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    const destino = request.nextUrl.clone();
    destino.pathname = RUTA_ACCESO;
    destino.search = "";
    const siguiente = request.nextUrl.pathname + request.nextUrl.search;
    if (siguiente !== "/") destino.searchParams.set("siguiente", siguiente);

    const redireccion = NextResponse.redirect(destino);
    for (const cookie of respuesta.cookies.getAll()) redireccion.cookies.set(cookie);
    for (const [clave, valor] of Object.entries(encabezadosDeCache)) redireccion.headers.set(clave, valor);
    return redireccion;
  }

  return respuesta;
}
