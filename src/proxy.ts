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
 * Corre en TODAS las rutas. Cuando el proxy corre, Next guarda el cuerpo en
 * memoria y lo RECORTA en proxyClientMaxBodySize (6 MB, next.config.ts). Las
 * subidas más grandes son la de la Biblioteca (4 MiB más 64 KiB del
 * formulario) y la importación del Excel (4 MiB): caben, así que el proxy no
 * recorta nada. Desde el Sprint 8a /biblioteca/subir ya no queda fuera y
 * recupera el refresco de sesión; la ruta conserva sus propias guardias.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const rechazo = rechazoPorHost(request.headers.get("host"));
  if (rechazo !== null) {
    return new NextResponse(rechazo.body, { status: rechazo.status, headers: rechazo.headers });
  }
  return actualizarSesion(request);
}

// Todas las rutas.
export const config = {
  matcher: ["/(.*)"],
};
