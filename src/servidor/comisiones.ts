import "server-only";
import * as z from "zod";
import { modeloComisiones, type ModeloComisiones } from "../aplicacion/comisiones";
import { esHostLocal } from "../aplicacion/host";
import type { ResultadoApp } from "../aplicacion/resultado";
import { ROLES_CON_META, TIPOS_INVERSION, type SemillaComisiones } from "../domain/comisiones/semilla";
import { MENSAJE_HOST_NO_LOCAL } from "./guardiaHost";
import { leerSemillaComisiones } from "./parametros";

export const MENSAJE_FORMA_COMISIONES =
  "La solicitud del simulador no tiene la forma esperada. Recarga la página y vuelve a intentarlo.";

/** Tope de inversiones por mes en el simulador (protege al servidor de listas enormes). */
export const MAXIMO_INVERSIONES = 50;

/** Los campos del simulador, sin el número de petición: los usa también el PDF de comisiones. */
export const esquemaCamposComisiones = z.strictObject({
  perfil: z.enum(["interno", "externo"]),
  rol: z.enum(ROLES_CON_META).nullable(),
  inversiones: z
    .array(
      z.strictObject({
        tipo: z.enum(TIPOS_INVERSION),
        monto: z.string().max(40),
        plazo: z.number().int().min(0).max(600).nullable(),
        fecha: z.string().max(10),
      }),
    )
    .max(MAXIMO_INVERSIONES),
  /** Solo GERENTE: inversiones del equipo para el bono de gerente (sin fecha). */
  equipo: z
    .array(
      z.strictObject({
        tipo: z.enum(TIPOS_INVERSION),
        monto: z.string().max(40),
        plazo: z.number().int().min(0).max(600).nullable(),
      }),
    )
    .max(MAXIMO_INVERSIONES),
  /** Solo internos: inversiones de sus externos para la comisión por externos (sin fecha). */
  externos: z
    .array(
      z.strictObject({
        tipo: z.enum(TIPOS_INVERSION),
        monto: z.string().max(40),
        plazo: z.number().int().min(0).max(600).nullable(),
      }),
    )
    .max(MAXIMO_INVERSIONES),
});

const esquemaCampos = esquemaCamposComisiones.extend({ peticion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) });

/** Respuesta de la acción: solo texto y números (sin Decimal ni semilla). */
export interface RespuestaComisiones {
  /** El número de petición recibido, para descartar respuestas viejas; null si no se pudo leer. */
  readonly peticion: number | null;
  readonly resultado:
    | { readonly tipo: "modelo"; readonly modelo: ModeloComisiones }
    | { readonly tipo: "error"; readonly mensaje: string; readonly detalles: readonly string[] };
}

const fallo = (peticion: number | null, mensaje: string, detalles: readonly string[] = []): RespuestaComisiones => ({
  peticion,
  resultado: { tipo: "error", mensaje, detalles: [...detalles] },
});

/**
 * Simula el mes con los campos de la pantalla. Valida la forma, lee la semilla
 * en cada llamada y no guarda ni registra nada de lo recibido.
 */
export async function simularCon(
  campos: unknown,
  host: string | null,
  leer: () => Promise<ResultadoApp<SemillaComisiones>> = leerSemillaComisiones,
): Promise<RespuestaComisiones> {
  // Seguro contra un despliegue accidental (no es seguridad real): ver guardiaHost.ts.
  if (!esHostLocal(host)) return fallo(null, MENSAJE_HOST_NO_LOCAL);

  const forma = esquemaCampos.safeParse(campos);
  if (!forma.success) return fallo(null, MENSAJE_FORMA_COMISIONES);
  const { peticion, ...resto } = forma.data;

  const semilla = await leer();
  if (!semilla.ok) return fallo(peticion, semilla.error.mensaje, semilla.error.detalles);

  const m = modeloComisiones(semilla.valor, resto);
  if (!m.ok) return fallo(peticion, m.error.mensaje, m.error.detalles);
  return { peticion, resultado: { tipo: "modelo", modelo: m.valor } };
}
