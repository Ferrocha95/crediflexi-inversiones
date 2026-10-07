import { MENSAJE_SESION_EXPIRADA } from "../../../../componentes/acceso/textos";
import { rechazoPorHost } from "../../../../servidor/guardiaHost";
import { leerParametrosCotizacion } from "../../../../servidor/parametros";
import { manejarPdf } from "../../../../servidor/pdf/manejador";
import { renderizarPdf } from "../../../../servidor/pdf/renderizar";
import { usuarioActual } from "../../../../servidor/sesion";

/**
 * POST /cotizador/pdf: genera el PDF de la cotización. Toda la lógica está en
 * manejarPdf, con sus dependencias inyectadas para probarla sin Next.
 *
 * Antes revisa al usuario: el proxy solo confirma que la sesión es válida, y
 * un usuario desactivado puede tener todavía una sesión vigente. Sin usuario
 * activo responde 401 en JSON, con el mensaje que la pantalla ya sabe mostrar.
 */
export async function POST(request: Request): Promise<Response> {
  const rechazo = rechazoPorHost(request.headers.get("host"));
  if (rechazo !== null) return rechazo;

  if ((await usuarioActual()) === null) {
    return Response.json({ error: MENSAJE_SESION_EXPIRADA }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  return manejarPdf(request, {
    leer: () => leerParametrosCotizacion(),
    renderizar: renderizarPdf,
    ahora: () => new Date(),
  });
}
