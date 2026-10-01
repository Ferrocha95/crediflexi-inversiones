import { NextResponse, type NextRequest } from "next/server";
import { rechazoPorHost } from "./servidor/guardiaHost";

/**
 * Proxy de Next 16 (antes "middleware"). Rechaza con 403 cualquier petición
 * cuyo Host no sea local: páginas, archivos estáticos y acciones del servidor
 * (que llegan como POST a la ruta de la página).
 *
 * NO es seguridad real, solo un seguro contra un despliegue accidental (ver
 * src/servidor/guardiaHost.ts). Por eso no lleva matcher: se aplica a todo.
 * La acción del cotizador repite la revisión, porque la documentación de Next
 * advierte que una acción puede invocarse fuera de la ruta que cubre el proxy.
 */
export function proxy(request: NextRequest): NextResponse {
  const rechazo = rechazoPorHost(request.headers.get("host"));
  if (rechazo !== null) {
    return new NextResponse(rechazo.body, { status: rechazo.status, headers: rechazo.headers });
  }
  return NextResponse.next();
}
