import "server-only";
import { modeloComisiones, type ModeloPdfComisiones } from "../../aplicacion/comisiones";
import { fechaEnMexico, fechaIsoEnMexico } from "../../aplicacion/fecha";
import { esHostLocal } from "../../aplicacion/host";
import type { ResultadoApp } from "../../aplicacion/resultado";
import { esquemaCamposComisiones, MENSAJE_FORMA_COMISIONES } from "../comisiones";
import { MENSAJE_HOST_NO_LOCAL } from "../guardiaHost";
import type { ParametrosComisiones } from "../parametros";
import { json, leerCuerpo, origenCoincide } from "./manejador";

export const MENSAJES_PDF_COMISIONES = {
  origenAjeno:
    "La petición del PDF no viene de esta misma página. Abre el simulador de comisiones con la dirección localhost y descarga el PDF desde ahí.",
  soloInternos: "El PDF de comisiones es para el perfil Interno (Ejecutivo o Gerente). Cambia el perfil y el rol para descargarlo.",
  sinInversiones: "Agrega al menos una inversión del mes para descargar el PDF.",
  fallaRender: "No se pudo generar el PDF. Vuelve a intentarlo; si sigue fallando, reinicia la app.",
} as const;

export interface DependenciasPdfComisiones {
  readonly leer: () => Promise<ResultadoApp<ParametrosComisiones>>;
  readonly renderizar: (modelo: ModeloPdfComisiones) => Promise<Uint8Array>;
  readonly ahora: () => Date;
}

/**
 * POST /comisiones/pdf. Recalcula la simulación del mes con la semilla y los
 * textos vigentes y responde el PDF (Gerente y Ejecutivo; el externo queda
 * fuera). No guarda ni registra nada de lo recibido.
 */
export async function manejarPdfComisiones(request: Request, deps: DependenciasPdfComisiones): Promise<Response> {
  // Seguro contra un despliegue accidental (no es seguridad real): ver guardiaHost.ts.
  const host = request.headers.get("host");
  if (host === null || !esHostLocal(host)) return json(403, MENSAJE_HOST_NO_LOCAL);
  if (!origenCoincide(request.headers.get("origin"), host)) return json(403, MENSAJES_PDF_COMISIONES.origenAjeno);

  const forma = esquemaCamposComisiones.safeParse(await leerCuerpo(request));
  if (!forma.success) return json(422, MENSAJE_FORMA_COMISIONES);
  const campos = forma.data;
  if (campos.perfil !== "interno" || campos.rol === null) return json(422, MENSAJES_PDF_COMISIONES.soloInternos);
  if (campos.inversiones.length === 0) return json(422, MENSAJES_PDF_COMISIONES.sinInversiones);

  const p = await deps.leer();
  if (!p.ok) return json(500, p.error.mensaje, p.error.detalles);

  const m = modeloComisiones(p.valor.semilla, campos);
  if (!m.ok) return json(422, m.error.mensaje, m.error.detalles);

  const ahora = deps.ahora();
  let bytes: Uint8Array;
  try {
    bytes = await deps.renderizar({ textos: p.valor.textos, fecha: fechaEnMexico(ahora), rol: campos.rol, comisiones: m.valor });
  } catch {
    return json(500, MENSAJES_PDF_COMISIONES.fallaRender);
  }

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "cache-control": "no-store",
      // Solo la fecha: el nombre del archivo no lleva datos de personas.
      "content-disposition": `attachment; filename="simulacion-de-comisiones-${fechaIsoEnMexico(ahora)}.pdf"`,
    },
  });
}
