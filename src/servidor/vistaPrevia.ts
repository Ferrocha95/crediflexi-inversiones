import "server-only";
import * as z from "zod";
import { modeloVistaPrevia, type ModeloVistaPrevia } from "../aplicacion/modelo";
import { normalizarMonto } from "../aplicacion/monto";
import { plazosDisponibles } from "../aplicacion/plazos";
import { cotizar } from "../domain/interes/cotizar";
import { ESQUEMAS, MONEDAS } from "../domain/tasas/semilla.esquema";
import { MENSAJE_HOST_NO_LOCAL } from "./guardiaHost";
import { esHostLocal } from "../aplicacion/host";
import { leerParametrosCotizacion, type ParametrosCotizacion } from "./parametros";
import type { ResultadoApp } from "../aplicacion/resultado";

export const MENSAJE_FORMA_INVALIDA =
  "La solicitud de vista previa no tiene la forma esperada. Recarga la página y vuelve a intentarlo.";

/** Lo que el navegador manda en cada petición de vista previa. */
const esquemaCampos = z.strictObject({
  peticion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  entidad: z.string().max(40),
  moneda: z.enum(MONEDAS),
  esquema: z.enum(ESQUEMAS),
  monto: z.string().max(40),
  plazo: z.number().int().positive().max(600).nullable(),
});

export type CamposVistaPrevia = z.infer<typeof esquemaCampos>;

export type ResultadoVistaPrevia =
  | { readonly tipo: "vista_previa"; readonly vistaPrevia: ModeloVistaPrevia }
  | { readonly tipo: "elige_plazo" }
  | { readonly tipo: "error"; readonly mensaje: string; readonly detalles: readonly string[] };

/** Respuesta de la acción: solo texto y números (sin Decimal ni semilla). */
export interface RespuestaVistaPrevia {
  /** El número de petición recibido, para descartar respuestas viejas; null si no se pudo leer. */
  readonly peticion: number | null;
  /** Plazos disponibles para el monto; null si no se pudieron calcular. */
  readonly plazos: readonly { readonly valor: number; readonly etiqueta: string }[] | null;
  readonly resultado: ResultadoVistaPrevia;
}

const fallo = (
  peticion: number | null,
  mensaje: string,
  detalles: readonly string[] = [],
  plazos: RespuestaVistaPrevia["plazos"] = null,
): RespuestaVistaPrevia => ({ peticion, plazos, resultado: { tipo: "error", mensaje, detalles: [...detalles] } });

/**
 * Calcula la vista previa a partir de los campos del formulario. Valida la
 * forma, normaliza el monto, calcula los plazos y, si el plazo elegido está
 * disponible, cotiza. No guarda ni registra nada de lo recibido.
 */
export async function previsualizarCon(
  campos: unknown,
  host: string | null,
  leer: () => Promise<ResultadoApp<ParametrosCotizacion>> = leerParametrosCotizacion,
): Promise<RespuestaVistaPrevia> {
  // Seguro contra un despliegue accidental (no es seguridad real): ver guardiaHost.ts.
  if (!esHostLocal(host)) return fallo(null, MENSAJE_HOST_NO_LOCAL);

  const forma = esquemaCampos.safeParse(campos);
  if (!forma.success) return fallo(null, MENSAJE_FORMA_INVALIDA);
  const { peticion, entidad, moneda, esquema, plazo } = forma.data;

  const parametros = await leer();
  if (!parametros.ok) return fallo(peticion, parametros.error.mensaje, parametros.error.detalles);
  const { semilla, textos } = parametros.valor;

  const monto = normalizarMonto(forma.data.monto);
  if (!monto.ok) return fallo(peticion, monto.error.mensaje);

  const consulta = { entidad, moneda, esquema, monto: monto.valor };
  const plazos = plazosDisponibles(semilla, consulta);
  if (!plazos.ok) return fallo(peticion, plazos.error.mensaje, plazos.error.detalles);
  const opcionesPlazo = plazos.valor.map((valor) => ({ valor, etiqueta: `${valor} meses` }));

  if (plazo === null || !plazos.valor.includes(plazo)) {
    return { peticion, plazos: opcionesPlazo, resultado: { tipo: "elige_plazo" } };
  }

  const c = cotizar(semilla, { ...consulta, plazo });
  if (!c.ok) return fallo(peticion, c.error.mensaje, c.error.detalles, opcionesPlazo);
  return {
    peticion,
    plazos: opcionesPlazo,
    resultado: { tipo: "vista_previa", vistaPrevia: modeloVistaPrevia(c.valor, textos) },
  };
}
