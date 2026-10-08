import "server-only";
import * as z from "zod";
import { esHostLocal } from "../aplicacion/host";
import { modeloReclutamiento, type ModeloReclutamiento } from "../aplicacion/reclutamiento";
import type { ResultadoApp } from "../aplicacion/resultado";
import { MENSAJE_HOST_NO_LOCAL } from "./guardiaHost";
import { leerParametrosReclutamiento, type ParametrosReclutamiento } from "./parametros";

export const MENSAJE_FORMA_RECLUTAMIENTO =
  "La solicitud del modo reclutamiento no tiene la forma esperada. Recarga la página y vuelve a intentarlo.";

/**
 * Lo que se toma del navegador (pantalla y PDF). Los topes de largo protegen al
 * servidor; los recortes finos (80 y 40 caracteres) los hace el modelo.
 */
export const esquemaReclutamiento = z.strictObject({
  presenta: z.string().max(200),
  escenarios: z
    .array(
      z.strictObject({
        nombre: z.string().max(100),
        montos: z.record(z.string().max(3), z.string().max(40)).refine((m) => Object.keys(m).length <= 10),
      }),
    )
    .length(3),
  /** Opcional (por omisión 1); el modelo valida que sea un entero de 1 a 20. */
  inversionesPorPlazo: z.number().int().min(-1000).max(1000).optional(),
});

export type CamposReclutamientoServidor = z.infer<typeof esquemaReclutamiento>;

/** Respuesta de la acción: solo texto y números. */
export interface RespuestaReclutamiento {
  readonly peticion: number | null;
  readonly resultado:
    | { readonly tipo: "modelo"; readonly modelo: ModeloReclutamiento }
    | { readonly tipo: "error"; readonly mensaje: string; readonly detalles: readonly string[] };
}

const fallo = (peticion: number | null, mensaje: string, detalles: readonly string[] = []): RespuestaReclutamiento => ({
  peticion,
  resultado: { tipo: "error", mensaje, detalles: [...detalles] },
});

const esquemaPeticion = esquemaReclutamiento.extend({ peticion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) });

/** Calcula el modo reclutamiento con los campos de la pantalla. No guarda ni registra nada de lo recibido. */
export async function simularReclutamientoCon(
  campos: unknown,
  host: string | null,
  leer: () => Promise<ResultadoApp<ParametrosReclutamiento>> = leerParametrosReclutamiento,
  ahora: () => Date = () => new Date(),
): Promise<RespuestaReclutamiento> {
  // Seguro contra un despliegue accidental (no es seguridad real): ver guardiaHost.ts.
  if (!esHostLocal(host)) return fallo(null, MENSAJE_HOST_NO_LOCAL);

  const forma = esquemaPeticion.safeParse(campos);
  if (!forma.success) return fallo(null, MENSAJE_FORMA_RECLUTAMIENTO);
  const { peticion, ...resto } = forma.data;

  const p = await leer();
  if (!p.ok) return fallo(peticion, p.error.mensaje, p.error.detalles);

  const m = modeloReclutamiento(p.valor.semilla, p.valor.textos, resto, ahora());
  if (!m.ok) return fallo(peticion, m.error.mensaje, m.error.detalles);
  return { peticion, resultado: { tipo: "modelo", modelo: m.valor } };
}
