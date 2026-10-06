import * as z from "zod";
import { listaEnEspanol } from "../domain/comun/formato";
import type { Esquema, Estatus } from "../domain/tasas/semilla.esquema";
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

/**
 * Marcadores permitidos en cada campo; los de estatus_tramo, nombre_esquema,
 * el resto del bloque pdf y todo el bloque pdf_pagina2 no admiten ninguno.
 */
export const MARCADORES_POR_CAMPO = {
  pie_base: ["razon_social", "version_tasas", "fecha_tasas"],
  linea_preparado_por: ["ejecutivo"],
  linea_vigencia: ["vigencia"],
  moneda_deshabilitada: ["moneda"],
  "pdf.linea_tasas": ["version_tasas", "fecha_tasas"],
} as const satisfies Readonly<Record<string, readonly Marcador[]>>;

export interface TextosCotizacion {
  readonly version: string;
  readonly pieBase: string;
  readonly lineaPreparadoPor: string;
  readonly lineaVigencia: string;
  /** Explicación del estatus del tramo: solo se muestra en pantalla, nunca en el PDF. */
  readonly estatusTramo: Readonly<Record<Estatus, string>>;
  /** Nombre del esquema en la pantalla y en el PDF. */
  readonly nombreEsquema: Readonly<Record<Esquema, string>>;
  readonly monedaDeshabilitada: string;
  /** Textos fijos del PDF. */
  readonly pdf: TextosPdf;
  /** Textos fijos de la página 2 del PDF (calendario, gráficas y escenario). */
  readonly pdfPagina2: TextosPagina2;
}

export interface TextosPdf {
  readonly titulo: string;
  /** Va antes del nombre: "Preparado para Persona Sintética Uno". */
  readonly preparadoPara: string;
  readonly fecha: string;
  readonly resumenMonto: string;
  readonly resumenPlazo: string;
  readonly resumenTasa: string;
  readonly resumenEsquema: string;
  readonly seccionResultados: string;
  readonly seccionCalculo: string;
  /** Plantilla con {version_tasas} y {fecha_tasas}. */
  readonly lineaTasas: string;
}

/** Textos de la página 2 del PDF. Ninguno admite marcadores. */
export interface TextosPagina2 {
  readonly titulo: string;
  readonly modalidad1: string;
  readonly modalidad2: string;
  readonly tasaAnual: string;
  readonly capitalInicial: string;
  readonly rendimientoEstimado: string;
  readonly total: string;
  readonly columnaMes: string;
  readonly columnaRendimientoMes: string;
  readonly columnaRendimientoAcumulado: string;
  /** Marca la modalidad de la cotización. */
  readonly insignia: string;
  readonly notaCentavos: string;
  /** Reemplaza la tarjeta de una modalidad que no se puede cotizar. */
  readonly modalidadNoDisponible: string;
  readonly tituloGrafica1: string;
  readonly notaGrafica1: string;
  readonly serieCobrado: string;
  readonly serieDevengado: string;
  readonly tituloGrafica2: string;
  readonly rotuloEscenario: string;
  readonly serieConReinversion: string;
  readonly serieSinReinvertir: string;
  readonly finPrimerPlazo: string;
  readonly notaEscenario: string;
  /** Reemplaza la gráfica 2 si el primer pago es menor al incremento mínimo. */
  readonly escenarioIncrementoMinimo: string;
  /** Reemplaza la gráfica 2 si alguna tasa del escenario no está disponible. */
  readonly escenarioTasaNoDisponible: string;
  /** "Página" y "de", para el pie "Página 1 de 2". */
  readonly pagina: string;
  readonly paginaDe: string;
}

/** Clave del archivo (snake_case) -> clave de TextosPagina2. */
const CLAVES_PAGINA2 = {
  titulo: "titulo",
  modalidad_1: "modalidad1",
  modalidad_2: "modalidad2",
  tasa_anual: "tasaAnual",
  capital_inicial: "capitalInicial",
  rendimiento_estimado: "rendimientoEstimado",
  total: "total",
  columna_mes: "columnaMes",
  columna_rendimiento_mes: "columnaRendimientoMes",
  columna_rendimiento_acumulado: "columnaRendimientoAcumulado",
  insignia: "insignia",
  nota_centavos: "notaCentavos",
  modalidad_no_disponible: "modalidadNoDisponible",
  titulo_grafica_1: "tituloGrafica1",
  nota_grafica_1: "notaGrafica1",
  serie_cobrado: "serieCobrado",
  serie_devengado: "serieDevengado",
  titulo_grafica_2: "tituloGrafica2",
  rotulo_escenario: "rotuloEscenario",
  serie_con_reinversion: "serieConReinversion",
  serie_sin_reinvertir: "serieSinReinvertir",
  fin_primer_plazo: "finPrimerPlazo",
  nota_escenario: "notaEscenario",
  escenario_incremento_minimo: "escenarioIncrementoMinimo",
  escenario_tasa_no_disponible: "escenarioTasaNoDisponible",
  pagina: "pagina",
  pagina_de: "paginaDe",
} as const satisfies Readonly<Record<string, keyof TextosPagina2>>;

type ClaveArchivoPagina2 = keyof typeof CLAVES_PAGINA2;

const RE_MARCADOR = /\{([^{}]*)\}/g;

function permitidosEn(campo: string, permitidos: readonly Marcador[]): string {
  return permitidos.length === 0
    ? `En ${campo} no se permite ningún marcador.`
    : `En ${campo} solo se permite${permitidos.length === 1 ? "" : "n"}: ${listaEnEspanol(permitidos.map((m) => `{${m}}`))}.`;
}

/** Texto no vacío que solo usa los marcadores permitidos en `campo`. */
function texto(campo: string, permitidos: readonly Marcador[] = []) {
  return z
    .string({ error: "Debe ser un texto." })
    .trim()
    .min(1, { error: "El texto no puede estar vacío.", abort: true })
    .superRefine((t, ctx) => {
      for (const [, nombre] of t.matchAll(RE_MARCADOR)) {
        if (!(permitidos as readonly string[]).includes(nombre)) {
          ctx.addIssue({
            code: "custom",
            message: `El marcador {${nombre}} no está permitido. ${permitidosEn(campo, permitidos)}`,
          });
        }
      }
      if (/[{}]/.test(t.replace(RE_MARCADOR, ""))) {
        ctx.addIssue({
          code: "custom",
          message: "Hay una llave { o } sin cerrar. Cada marcador se escribe entre llaves, por ejemplo {razon_social}.",
        });
      }
    });
}

function claveDesconocida(iss: { code: string; keys?: readonly string[] }): string | undefined {
  if (iss.code !== "unrecognized_keys" || iss.keys === undefined) return undefined;
  return `Clave desconocida: ${iss.keys.map((k) => `"${k}"`).join(", ")}. Revisa que esté bien escrita o quítala.`;
}

const esquemaTextos = z
  .strictObject(
    {
      version: z.string({ error: "Falta la versión del archivo (texto)." }).trim().min(1),
      pie_base: texto("pie_base", MARCADORES_POR_CAMPO.pie_base),
      linea_preparado_por: texto("linea_preparado_por", MARCADORES_POR_CAMPO.linea_preparado_por),
      linea_vigencia: texto("linea_vigencia", MARCADORES_POR_CAMPO.linea_vigencia),
      estatus_tramo: z.strictObject(
        {
          SEGUN_USUARIO_PPTX: texto("estatus_tramo.SEGUN_USUARIO_PPTX"),
          CONFIRMADA: texto("estatus_tramo.CONFIRMADA"),
          POR_CONFIRMAR: texto("estatus_tramo.POR_CONFIRMAR"),
        },
        { error: claveDesconocida },
      ),
      nombre_esquema: z.strictObject(
        {
          mensual: texto("nombre_esquema.mensual"),
          final_del_plazo: texto("nombre_esquema.final_del_plazo"),
        },
        { error: claveDesconocida },
      ),
      moneda_deshabilitada: texto("moneda_deshabilitada", MARCADORES_POR_CAMPO.moneda_deshabilitada),
      pdf: z.strictObject(
        {
          titulo: texto("pdf.titulo"),
          preparado_para: texto("pdf.preparado_para"),
          fecha: texto("pdf.fecha"),
          resumen_monto: texto("pdf.resumen_monto"),
          resumen_plazo: texto("pdf.resumen_plazo"),
          resumen_tasa: texto("pdf.resumen_tasa"),
          resumen_esquema: texto("pdf.resumen_esquema"),
          seccion_resultados: texto("pdf.seccion_resultados"),
          seccion_calculo: texto("pdf.seccion_calculo"),
          linea_tasas: texto("pdf.linea_tasas", MARCADORES_POR_CAMPO["pdf.linea_tasas"]),
        },
        { error: claveDesconocida },
      ),
      pdf_pagina2: z.strictObject(
        Object.fromEntries(
          Object.keys(CLAVES_PAGINA2).map((clave) => [clave, texto(`pdf_pagina2.${clave}`)]),
        ) as Record<ClaveArchivoPagina2, ReturnType<typeof texto>>,
        { error: claveDesconocida },
      ),
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
      nombreEsquema: t.nombre_esquema,
      monedaDeshabilitada: t.moneda_deshabilitada,
      pdf: {
        titulo: t.pdf.titulo,
        preparadoPara: t.pdf.preparado_para,
        fecha: t.pdf.fecha,
        resumenMonto: t.pdf.resumen_monto,
        resumenPlazo: t.pdf.resumen_plazo,
        resumenTasa: t.pdf.resumen_tasa,
        resumenEsquema: t.pdf.resumen_esquema,
        seccionResultados: t.pdf.seccion_resultados,
        seccionCalculo: t.pdf.seccion_calculo,
        lineaTasas: t.pdf.linea_tasas,
      },
      pdfPagina2: Object.fromEntries(
        (Object.entries(CLAVES_PAGINA2) as [ClaveArchivoPagina2, keyof TextosPagina2][]).map(([archivo, clave]) => [
          clave,
          t.pdf_pagina2[archivo],
        ]),
      ) as unknown as TextosPagina2,
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
