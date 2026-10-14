import { NextResponse, type NextRequest } from "next/server";
import { rechazoPorHost } from "./servidor/guardiaHost";
import { actualizarSesion } from "./servidor/supabase/proxy";

/**
 * Proxy de Next 16 (antes "middleware"). Primero rechaza con 403 cualquier
 * petición cuyo Host no sea local: páginas, archivos estáticos y acciones del
 * servidor (que llegan como POST a la ruta de la página). Luego refresca la
 * sesión de Supabase y manda a /acceso a quien no la tiene.
 *
 * El guardia de Host NO es seguridad real, solo un seguro contra un despliegue
 * accidental (ver src/servidor/guardiaHost.ts). Se aplica a todo, y las rutas
 * que no piden sesión se deciden dentro de actualizarSesion. Cada acción repite
 * las dos revisiones, porque la documentación de Next advierte que una acción
 * puede invocarse fuera de la ruta que cubre el proxy.
 *
 * Única excepción: /biblioteca/subir (exacta). Cuando el proxy corre, Next
 * guarda el cuerpo en memoria y lo RECORTA en proxyClientMaxBodySize (6 MB,
 * next.config.ts); esa ruta recibe hasta 25 MiB. Por eso queda fuera, y repite
 * por su cuenta el guardia de host, el Origin, la sesión y el rol, y lee el
 * cuerpo con su propio tope (ver src/app/(app)/biblioteca/subir/route.ts).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const rechazo = rechazoPorHost(request.headers.get("host"));
  if (rechazo !== null) {
    return new NextResponse(rechazo.body, { status: rechazo.status, headers: rechazo.headers });
  }
  return actualizarSesion(request);
}

// Todo, menos exactamente /biblioteca/subir (/biblioteca/subir/x sí pasa).
export const config = {
  matcher: ["/((?!biblioteca/subir$).*)"],
};
