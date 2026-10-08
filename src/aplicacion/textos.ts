import * as z from "zod";
import { listaEnEspanol } from "../domain/comun/formato";
import type { Esquema, Estatus, Salida } from "../domain/tasas/semilla.esquema";
import { validar, type ResultadoApp } from "./resultado";

/** Marcadores que se pueden usar en seed/textos_cotizacion.json. */
export const MARCADORES = [
  "razon_social",
  "version_tasas",
  "fecha_tasas",
  "ejecutivo",
  "vigencia",
  "moneda",
  "tasa_tabla",
  "puntos",
  "tasa",
  "meses",
  "fecha",
  "fuentes",
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
  "pdf.desglose_puntos": ["tasa_tabla", "puntos", "tasa"],
  "pdf_pagina2.pago_ganancia_mensual": ["meses"],
  "pdf_pagina2.pago_ganancia_vencimiento": ["meses"],
  "pdf_pagina2.capital_vencimiento": ["meses"],
  "pdf_pagina2.benchmark_actualizado": ["fecha"],
  "pdf_pagina2.benchmark_fuentes": ["fuentes"],
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
  /** Aviso del fondo, en el pie de las dos páginas del PDF (todas las entidades). */
  readonly pieAvisoFondo: string;
  /** Línea SIPRES por entidad; la entidad que no aparece no lleva bloque SIPRES. */
  readonly pieSipres: Readonly<Record<string, string>>;
  /** Etiqueta de cada resultado, por esquema (pantalla y PDF). */
  readonly etiquetasResultados: Readonly<Record<Esquema, Readonly<Record<Salida, string>>>>;
  /** "Pago de la ganancia: cada mes" o "al vencimiento", por esquema (página 1 y vista previa). */
  readonly lineaPago: Readonly<Record<Esquema, string>>;
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
  /** Etiqueta del plazo en un plazo especial. */
  readonly plazoEspecial: string;
  /** Etiqueta de la tasa en un plazo especial (nunca "tasa de tabla"). */
  readonly tasaAcordada: string;
  /** Plantilla con {tasa_tabla}, {puntos} y {tasa}: el desglose de los puntos extra. */
  readonly desglosePuntos: string;
}

/** Textos de la página 2 del PDF. Solo las líneas de cuándo se paga admiten {meses}. */
export interface TextosPagina2 {
  readonly titulo: string;
  readonly modalidad1: string;
  readonly modalidad2: string;
  readonly tasaAnual: string;
  /** En lugar de tasaAnual en un plazo especial. */
  readonly tasaAcordada: string;
  readonly capitalInicial: string;
  readonly gananciaAnualEquivalente: string;
  readonly gananciaPlazo: string;
  readonly totalCapitalGanancia: string;
  /** Plantillas con {meses}: cuándo se paga la ganancia y el capital. */
  readonly pagoGananciaMensual: string;
  readonly pagoGananciaVencimiento: string;
  readonly capitalVencimiento: string;
  /** Rótulos de la franja de tiempo de cada tarjeta. */
  readonly franjaGanancia: string;
  readonly franjaMasCapital: string;
  readonly franjaGananciaCapital: string;
  readonly columnaMes: string;
  readonly columnaGananciaPeriodo: string;
  readonly columnaGananciaAcumulada: string;
  /** Marca la modalidad de la cotización. */
  readonly insignia: string;
  readonly notaCentavos: string;
  /** Reemplaza la tarjeta de una modalidad que no se puede cotizar. */
  readonly modalidadNoDisponible: string;
  /** Reemplaza la tarjeta de una modalidad sin tasa acordada (plazo especial). */
  readonly modalidadSinTasa: string;
  readonly tituloGrafica1: string;
  readonly notaGrafica1: string;
  readonly serieCobrado: string;
  readonly serieDevengado: string;
  /** Reemplaza la gráfica de comparación si falta la tasa de una modalidad. */
  readonly comparacionOmitida: string;
  /** Comparativo de tasas (seed/benchmark.json). */
  readonly benchmarkTitulo: string;
  /** Rótulo de la barra de la tasa cotizada. */
  readonly benchmarkTuTasa: string;
  /** Plantilla con {fecha}: "Actualizado al 7 de octubre de 2026". */
  readonly benchmarkActualizado: string;
  /** Plantilla con {fuentes}: los nombres cortos de las fuentes. */
  readonly benchmarkFuentes: string;
  /** Reemplaza al comparativo si los datos pasan de la antigüedad máxima. */
  readonly benchmarkDesactualizado: string;
  /** Reemplaza al comparativo en una cotización en dólares. */
  readonly benchmarkSoloPesos: string;
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
  tasa_acordada: "tasaAcordada",
  capital_inicial: "capitalInicial",
  ganancia_anual_equivalente: "gananciaAnualEquivalente",
  ganancia_plazo: "gananciaPlazo",
  total_capital_ganancia: "totalCapitalGanancia",
  pago_ganancia_mensual: "pagoGananciaMensual",
  pago_ganancia_vencimiento: "pagoGananciaVencimiento",
  capital_vencimiento: "capitalVencimiento",
  franja_ganancia: "franjaGanancia",
  franja_mas_capital: "franjaMasCapital",
  franja_ganancia_capital: "franjaGananciaCapital",
  columna_mes: "columnaMes",
  columna_ganancia_periodo: "columnaGananciaPeriodo",
  columna_ganancia_acumulada: "columnaGananciaAcumulada",
  insignia: "insignia",
  nota_centavos: "notaCentavos",
  modalidad_no_disponible: "modalidadNoDisponible",
  modalidad_sin_tasa: "modalidadSinTasa",
  titulo_grafica_1: "tituloGrafica1",
  nota_grafica_1: "notaGrafica1",
  serie_cobrado: "serieCobrado",
  serie_devengado: "serieDevengado",
  comparacion_omitida: "comparacionOmitida",
  benchmark_titulo: "benchmarkTitulo",
  benchmark_tu_tasa: "benchmarkTuTasa",
  benchmark_actualizado: "benchmarkActualizado",
  benchmark_fuentes: "benchmarkFuentes",
  benchmark_desactualizado: "benchmarkDesactualizado",
  benchmark_solo_pesos: "benchmarkSoloPesos",
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

/** Las etiquetas de las tres salidas de un esquema. */
const etiquetasDeResultados = (campo: string) =>
  z.strictObject(
    {
      rendimiento_mensual_pesos: texto(`${campo}.rendimiento_mensual_pesos`),
      rendimiento_anual_pesos: texto(`${campo}.rendimiento_anual_pesos`),
      ganancia_total_plazo: texto(`${campo}.ganancia_total_plazo`),
    },
    { error: claveDesconocida },
  );

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
      pie_aviso_fondo: texto("pie_aviso_fondo"),
      pie_sipres: z.record(z.string().min(1), texto("pie_sipres")),
      etiquetas_resultados: z.strictObject(
        {
          mensual: etiquetasDeResultados("etiquetas_resultados.mensual"),
          final_del_plazo: etiquetasDeResultados("etiquetas_resultados.final_del_plazo"),
        },
        { error: claveDesconocida },
      ),
      linea_pago: z.strictObject(
        { mensual: texto("linea_pago.mensual"), final_del_plazo: texto("linea_pago.final_del_plazo") },
        { error: claveDesconocida },
      ),
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
          plazo_especial: texto("pdf.plazo_especial"),
          tasa_acordada: texto("pdf.tasa_acordada"),
          desglose_puntos: texto("pdf.desglose_puntos", MARCADORES_POR_CAMPO["pdf.desglose_puntos"]),
        },
        { error: claveDesconocida },
      ),
      pdf_pagina2: z.strictObject(
        Object.fromEntries(
          Object.keys(CLAVES_PAGINA2).map((clave) => {
            const campo = `pdf_pagina2.${clave}`;
            const permitidos = (MARCADORES_POR_CAMPO as Readonly<Record<string, readonly Marcador[]>>)[campo] ?? [];
            return [clave, texto(campo, permitidos)];
          }),
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
      pieAvisoFondo: t.pie_aviso_fondo,
      pieSipres: t.pie_sipres,
      etiquetasResultados: t.etiquetas_resultados,
      lineaPago: t.linea_pago,
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
        plazoEspecial: t.pdf.plazo_especial,
        tasaAcordada: t.pdf.tasa_acordada,
        desglosePuntos: t.pdf.desglose_puntos,
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
