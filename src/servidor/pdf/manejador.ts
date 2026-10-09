import "server-only";
import * as z from "zod";
import { fechaIsoEnMexico } from "../../aplicacion/fecha";
import { esHostLocal } from "../../aplicacion/host";
import { modeloPdf, TOPES, type ModeloPdf } from "../../aplicacion/modelo";
import { normalizarMonto } from "../../aplicacion/monto";
import { datosPagina2 } from "../../aplicacion/pagina2";
import type { ResultadoApp } from "../../aplicacion/resultado";
import { ajusteDesdeCampos } from "../../aplicacion/ajustes";
import { cotizarConAjuste } from "../../domain/interes/ajustes";
import { ESQUEMAS, MONEDAS } from "../../domain/tasas/semilla.esquema";
import { MENSAJE_HOST_NO_LOCAL } from "../guardiaHost";
import type { ParametrosCotizacion } from "../parametros";

export const MENSAJES_PDF = {
  origenAjeno:
    "La petición del PDF no viene de esta misma página. Abre el cotizador con la dirección localhost y genera el PDF desde ahí.",
  formaInvalida: "La solicitud del PDF no tiene la forma esperada. Recarga la página y vuelve a intentarlo.",
  sinConfirmar:
    'Antes de generar el PDF, revisa la vista previa y marca la casilla "Confirmo que los datos capturados son correctos".',
  tasasCambiaron: "Las tasas cambiaron desde tu vista previa; vuelve a revisarla.",
  fallaRender: "No se pudo generar el PDF. Vuelve a intentarlo; si sigue fallando, reinicia la app.",
} as const;

export interface DependenciasPdf {
  /** Lee y valida la semilla y los textos. */
  readonly leer: () => Promise<ResultadoApp<ParametrosCotizacion>>;
  readonly renderizar: (modelo: ModeloPdf) => Promise<Uint8Array>;
  readonly ahora: () => Date;
}

/** Texto opcional con tope en caracteres (no en unidades UTF-16), igual que limpiarCampo. */
const opcional = (tope: number) =>
  z
    .string()
    .refine((t) => Array.from(t).length <= tope)
    .optional();

/**
 * Lo único que se toma del navegador. Los tipos son estrictos (sin
 * conversiones); las claves de más se descartan sin leerse: cualquier cifra,
 * tasa o texto que mande el navegador no se usa, todo se recalcula.
 */
const esquemaCuerpo = z.object({
  entidad: z.string().max(40),
  moneda: z.enum(MONEDAS),
  esquema: z.enum(ESQUEMAS),
  monto: z.string().max(40),
  plazo: z.number().int().positive().max(600),
  confirmado: z.unknown().optional(),
  versionTasas: z.string().max(40),
  preparadoPara: opcional(TOPES.preparadoPara),
  ejecutivo: opcional(TOPES.ejecutivo),
  vigencia: opcional(TOPES.vigencia),
  notaAdicional: opcional(TOPES.notaAdicional),
  /** Puntos extra sobre la tasa de tabla; el dominio valida el valor. Ausente = 0. */
  puntosExtra: z.string().max(10).optional(),
  /** Plazo especial con sus tasas acordadas; el dominio valida. Ausente o null = plazo de tabla. */
  especial: z
    .object({
      plazo: z.number().int().min(-1000).max(1000),
      tasaMensual: z.string().max(20).nullable(),
      tasaFinal: z.string().max(20).nullable(),
    })
    .nullable()
    .optional(),
});

export function json(status: number, mensaje: string, detalles?: readonly string[]): Response {
  const cuerpo = detalles === undefined || detalles.length === 0 ? { error: mensaje } : { error: mensaje, detalles };
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** El Origin, si viene, debe ser el mismo Host de la petición. */
export function origenCoincide(origin: string | null, host: string): boolean {
  if (origin === null) return true;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export async function leerCuerpo(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/**
 * POST /cotizador/pdf. Recalcula la cotización con los parámetros vigentes y
 * responde el PDF. No guarda ni registra nada de lo recibido.
 */
export async function manejarPdf(request: Request, deps: DependenciasPdf): Promise<Response> {
  // Seguro contra un despliegue accidental (no es seguridad real): ver guardiaHost.ts.
  const host = request.headers.get("host");
  if (host === null || !esHostLocal(host)) return json(403, MENSAJE_HOST_NO_LOCAL);
  if (!origenCoincide(request.headers.get("origin"), host)) return json(403, MENSAJES_PDF.origenAjeno);

  const forma = esquemaCuerpo.safeParse(await leerCuerpo(request));
  if (!forma.success) return json(422, MENSAJES_PDF.formaInvalida);
  const { entidad, moneda, esquema, plazo, confirmado, versionTasas, puntosExtra, especial, ...entrada } = forma.data;
  if (confirmado !== true) return json(422, MENSAJES_PDF.sinConfirmar);

  const parametros = await deps.leer();
  if (!parametros.ok) return json(500, parametros.error.mensaje, parametros.error.detalles);
  const { semilla, razonesSociales, textos, benchmark } = parametros.valor;
  if (versionTasas !== semilla.version) return json(409, MENSAJES_PDF.tasasCambiaron);

  const monto = normalizarMonto(forma.data.monto);
  if (!monto.ok) return json(422, monto.error.mensaje);

  const ajuste = ajusteDesdeCampos({ puntosExtra: puntosExtra ?? "0", especial: especial ?? null });
  if (!ajuste.ok) return json(422, ajuste.error.mensaje);
  // En un plazo especial manda el plazo acordado, no el de la tabla.
  const solicitud = {
    entidad,
    moneda,
    esquema,
    monto: monto.valor,
    plazo: ajuste.valor.tipo === "especial" ? ajuste.valor.plazo : plazo,
  };
  const c = cotizarConAjuste(semilla, solicitud, ajuste.valor);
  if (!c.ok) return json(422, c.error.mensaje, c.error.detalles);

  const ahora = deps.ahora();
  const datos = datosPagina2(semilla, solicitud, ajuste.valor);
  const modelo = modeloPdf(c.valor, { razonesSociales, textos, benchmark }, entrada, ahora, datos);
  if (!modelo.ok) return json(500, modelo.error.mensaje, modelo.error.detalles);

  let bytes: Uint8Array;
  try {
    bytes = await deps.renderizar(modelo.valor);
  } catch {
    return json(500, MENSAJES_PDF.fallaRender);
  }

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "cache-control": "no-store",
      // Solo la fecha: el nombre del archivo no lleva datos de personas.
      "content-disposition": `attachment; filename="cotizacion-${fechaIsoEnMexico(ahora)}.pdf"`,
    },
  });
}
