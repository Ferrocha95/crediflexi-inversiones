import { MENSAJE_SESION_EXPIRADA } from "../../../../../componentes/acceso/textos";
import { rechazoPorHost } from "../../../../../servidor/guardiaHost";
import { leerParametrosReclutamiento } from "../../../../../servidor/parametros";
import { manejarPdfReclutamiento } from "../../../../../servidor/pdf/manejadorReclutamiento";
import { renderizarReclutamiento } from "../../../../../servidor/pdf/renderizar";
import { usuarioActual } from "../../../../../servidor/sesion";

/**
 * POST /comisiones/reclutamiento/pdf: "Propuesta de ingresos" de una página.
 * Toda la lógica está en manejarPdfReclutamiento, con sus dependencias
 * inyectadas para probarla sin Next. Antes revisa el host y al usuario activo.
 */
export async function POST(request: Request): Promise<Response> {
  const rechazo = rechazoPorHost(request.headers.get("host"));
  if (rechazo !== null) return rechazo;

  if ((await usuarioActual()) === null) {
    return Response.json({ error: MENSAJE_SESION_EXPIRADA }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  return manejarPdfReclutamiento(request, {
    leer: () => leerParametrosReclutamiento(),
    renderizar: (modelo) => renderizarReclutamiento(modelo),
    ahora: () => new Date(),
  });
}
