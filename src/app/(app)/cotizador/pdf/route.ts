import { leerParametrosCotizacion } from "../../../../servidor/parametros";
import { manejarPdf } from "../../../../servidor/pdf/manejador";
import { renderizarPdf } from "../../../../servidor/pdf/renderizar";

/**
 * POST /cotizador/pdf: genera el PDF de la cotización. Toda la lógica está en
 * manejarPdf, con sus dependencias inyectadas para probarla sin Next.
 */
export async function POST(request: Request): Promise<Response> {
  return manejarPdf(request, {
    leer: () => leerParametrosCotizacion(),
    renderizar: renderizarPdf,
    ahora: () => new Date(),
  });
}
