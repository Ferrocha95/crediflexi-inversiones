import "server-only";
import { fechaIsoEnMexico } from "../../aplicacion/fecha";
import { esHostLocal } from "../../aplicacion/host";
import { modeloReclutamiento, type ModeloReclutamiento } from "../../aplicacion/reclutamiento";
import type { ResultadoApp } from "../../aplicacion/resultado";
import { MENSAJE_HOST_NO_LOCAL } from "../guardiaHost";
import type { ParametrosReclutamiento } from "../parametros";
import { esquemaReclutamiento, MENSAJE_FORMA_RECLUTAMIENTO } from "../reclutamiento";
import { json, leerCuerpo, origenCoincide } from "./manejador";

export const MENSAJES_PDF_RECLUTAMIENTO = {
  origenAjeno:
    "La petición del PDF no viene de esta misma página. Abre el modo reclutamiento con la dirección localhost y descarga el PDF desde ahí.",
  fallaRender: "No se pudo generar el PDF. Vuelve a intentarlo; si sigue fallando, reinicia la app.",
} as const;

export interface DependenciasPdfReclutamiento {
  readonly leer: () => Promise<ResultadoApp<ParametrosReclutamiento>>;
  readonly renderizar: (modelo: ModeloReclutamiento) => Promise<Uint8Array>;
  readonly ahora: () => Date;
}

/**
 * POST /comisiones/reclutamiento/pdf. Recalcula todo con la semilla y los
 * textos vigentes y responde la "Propuesta de ingresos" de una página. No
 * guarda ni registra nada de lo recibido.
 */
export async function manejarPdfReclutamiento(request: Request, deps: DependenciasPdfReclutamiento): Promise<Response> {
  // Seguro contra un despliegue accidental (no es seguridad real): ver guardiaHost.ts.
  const host = request.headers.get("host");
  if (host === null || !esHostLocal(host)) return json(403, MENSAJE_HOST_NO_LOCAL);
  if (!origenCoincide(request.headers.get("origin"), host)) return json(403, MENSAJES_PDF_RECLUTAMIENTO.origenAjeno);

  const forma = esquemaReclutamiento.safeParse(await leerCuerpo(request));
  if (!forma.success) return json(422, MENSAJE_FORMA_RECLUTAMIENTO);

  const p = await deps.leer();
  if (!p.ok) return json(500, p.error.mensaje, p.error.detalles);

  const ahora = deps.ahora();
  const m = modeloReclutamiento(p.valor.semilla, p.valor.textos, forma.data, ahora);
  if (!m.ok) return json(422, m.error.mensaje, m.error.detalles);

  let bytes: Uint8Array;
  try {
    bytes = await deps.renderizar(m.valor);
  } catch {
    return json(500, MENSAJES_PDF_RECLUTAMIENTO.fallaRender);
  }

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "cache-control": "no-store",
      // Solo la fecha: el nombre del archivo no lleva datos de personas.
      "content-disposition": `attachment; filename="propuesta-de-ingresos-${fechaIsoEnMexico(ahora)}.pdf"`,
    },
  });
}
