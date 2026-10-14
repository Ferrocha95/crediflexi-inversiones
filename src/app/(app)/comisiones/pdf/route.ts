import { MENSAJE_SESION_EXPIRADA } from "../../../../componentes/acceso/textos";
import { rechazoPorHost } from "../../../../servidor/guardiaHost";
import { leerParametrosComisiones } from "../../../../servidor/parametros";
import { manejarPdfComisiones } from "../../../../servidor/pdf/manejadorComisiones";
import { renderizarComisiones } from "../../../../servidor/pdf/renderizar";
import { usuarioActual } from "../../../../servidor/sesion";

/**
 * POST /comisiones/pdf: PDF de la simulación de comisiones del mes (Gerente y
 * Ejecutivo). Toda la lógica está en manejarPdfComisiones, con sus
 * dependencias inyectadas para probarla sin Next. Antes revisa el host y al
 * usuario activo.
 */
export async function POST(request: Request): Promise<Response> {
  const rechazo = rechazoPorHost(request.headers.get("host"));
  if (rechazo !== null) return rechazo;

  if ((await usuarioActual()) === null) {
    return Response.json({ error: MENSAJE_SESION_EXPIRADA }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  return manejarPdfComisiones(request, {
    leer: () => leerParametrosComisiones(),
    renderizar: (modelo) => renderizarComisiones(modelo),
    ahora: () => new Date(),
  });
}
