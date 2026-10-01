import * as z from "zod";
import type { Estatus } from "../domain/tasas/semilla.esquema";
import { validar, type ResultadoApp } from "./resultado";

/** Marcadores que se pueden usar en seed/textos_cotizacion.json. */
export const MARCADORES = [
  "razon_social",
  "version_tasas",
  "fecha_tasas",
  "ejecutivo",
  "vigencia",
  "moneda",
] as const;
export type Marcador = (typeof MARCADORES)[number];

/** {moneda} solo tiene sentido en moneda_deshabilitada. */
const MARCADORES_GENERALES: readonly Marcador[] = MARCADORES.filter((m) => m !== "moneda");

export interface TextosCotizacion {
  readonly version: string;
  readonly pieBase: string;
  readonly lineaPreparadoPor: string;
  readonly lineaVigencia: string;
  /** Explicación del estatus del tramo: solo se muestra en pantalla, nunca en el PDF. */
  readonly estatusTramo: Readonly<Record<Estatus, string>>;
  readonly monedaDeshabilitada: string;
}

const RE_MARCADOR = /\{([^{}]*)\}/g;

const lista = (ms: readonly Marcador[]) => ms.map((m) => `{${m}}`).join(", ");

function textoConMarcadores(permitidos: readonly Marcador[]) {
  return z
    .string({ error: "Debe ser un texto." })
    .trim()
    .min(1, { error: "El texto no puede estar vacío.", abort: true })
    .superRefine((texto, ctx) => {
      for (const [, nombre] of texto.matchAll(RE_MARCADOR)) {
        if (!(permitidos as readonly string[]).includes(nombre)) {
          const soloMoneda = nombre === "moneda" ? " {moneda} solo se permite en moneda_deshabilitada." : "";
          ctx.addIssue({
            code: "custom",
            message: `El marcador {${nombre}} no está permitido aquí.${soloMoneda} Usa solo: ${lista(permitidos)}.`,
          });
        }
      }
      if (/[{}]/.test(texto.replace(RE_MARCADOR, ""))) {
        ctx.addIssue({
          code: "custom",
          message: "Hay una llave { o } sin cerrar. Cada marcador se escribe entre llaves, por ejemplo {razon_social}.",
        });
      }
    });
}

const texto = textoConMarcadores(MARCADORES_GENERALES);

function claveDesconocida(iss: { code: string; keys?: readonly string[] }): string | undefined {
  if (iss.code !== "unrecognized_keys" || iss.keys === undefined) return undefined;
  return `Clave desconocida: ${iss.keys.map((k) => `"${k}"`).join(", ")}. Revisa que esté bien escrita o quítala.`;
}

const esquemaTextos = z
  .strictObject(
    {
      version: z.string({ error: "Falta la versión del archivo (texto)." }).trim().min(1),
      pie_base: texto,
      linea_preparado_por: texto,
      linea_vigencia: texto,
      estatus_tramo: z.strictObject(
        {
          SEGUN_USUARIO_PPTX: texto,
          CONFIRMADA: texto,
          POR_CONFIRMAR: texto,
        },
        { error: claveDesconocida },
      ),
      moneda_deshabilitada: textoConMarcadores(MARCADORES),
    },
    { error: claveDesconocida },
  )
  .transform(
    (t): TextosCotizacion => ({
      version: t.version,
      pieBase: t.pie_base,
      lineaPreparadoPor: t.linea_preparado_por,
      lineaVigencia: t.linea_vigencia,
      estatusTramo: t.estatus_tramo,
      monedaDeshabilitada: t.moneda_deshabilitada,
    }),
  );

/**
 * Valida los textos de la cotización y los convierte a la forma de la
 * aplicación. Es pura: recibe el objeto ya leído y el nombre del archivo para
 * los mensajes.
 */
export function cargarTextos(json: unknown, archivo: string): ResultadoApp<TextosCotizacion> {
  return validar(esquemaTextos, json, "TEXTOS_INVALIDOS", archivo);
}
