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
 * accidental (ver src/servidor/guardiaHost.ts). Por eso no lleva matcher: se
 * aplica a todo, y las rutas que no piden sesión se deciden dentro de
 * actualizarSesion. Cada acción repite las dos revisiones, porque la
 * documentación de Next advierte que una acción puede invocarse fuera de la
 * ruta que cubre el proxy.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const rechazo = rechazoPorHost(request.headers.get("host"));
  if (rechazo !== null) {
    return new NextResponse(rechazo.body, { status: rechazo.status, headers: rechazo.headers });
  }
  return actualizarSesion(request);
}
