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
  "presenta",
  "dia_corte",
  "dia_siguiente",
  "mes",
  "fecha_pago",
  "n",
  "captacion",
  "comision",
  "bono",
  "meses_mayor",
  "meses_menor",
  "veces",
  "desde",
  "hasta",
  "monto_minimo",
  "meta",
  "porcentaje",
  "umbral",
] as const;
export type Marcador = (typeof MARCADORES)[number];

/**
 * Marcadores permitidos en cada campo; los de estatus_tramo, el resto del
 * glosario, el resto del bloque pdf y el resto de pdf_pagina2 no admiten ninguno.
 */
export const MARCADORES_POR_CAMPO = {
  pie_base: ["razon_social", "version_tasas", "fecha_tasas"],
  linea_preparado_por: ["ejecutivo"],
  linea_vigencia: ["vigencia"],
  moneda_deshabilitada: ["moneda"],
  "pdf.linea_tasas": ["version_tasas", "fecha_tasas"],
  "pdf.desglose_puntos": ["tasa_tabla", "puntos", "tasa"],
  "glosario.rendimiento_total": ["meses"],
  "glosario.pago_rendimiento_final": ["meses"],
  detalle_pago_mensual: ["meses"],
  "pdf_pagina2.capital_vencimiento": ["meses"],
  "pdf_pagina2.benchmark_actualizado": ["fecha"],
  "pdf_pagina2.benchmark_fuentes": ["fuentes"],
  "reclutamiento.aviso": ["fecha"],
  "reclutamiento.aviso_inversiones_por_plazo": ["n"],
  "reclutamiento.monto_plazo": ["meses"],
  "reclutamiento.plazo_meses": ["meses"],
  "reclutamiento.cifra_detalle": ["captacion", "meses", "comision", "bono"],
  "reclutamiento.cifra_detalle_mezcla": ["captacion", "comision", "bono"],
  "reclutamiento.frase_veces": ["meses_mayor", "veces", "meses_menor"],
  "reclutamiento.escalon_sin_bono": ["desde"],
  "reclutamiento.escalon_rango": ["desde", "hasta", "bono"],
  "reclutamiento.escalon_ultimo": ["desde", "bono"],
  "reclutamiento.frases": ["monto_minimo"],
  "reclutamiento.pdf_presenta": ["presenta"],
  "reclutamiento.fecha_quincena_1": ["dia_corte", "mes", "fecha_pago"],
  "reclutamiento.fecha_quincena_2": ["dia_siguiente", "mes", "fecha_pago"],
  "comisiones.nota_meta_interna": ["meta"],
  "comisiones.incentivo_mas_comision": ["bono"],
  "comisiones.nota_desbloqueo": ["porcentaje", "umbral"],
  "comisiones.inversion_externo": ["n"],
  "comisiones.quitar_externo": ["n"],
  "comisiones.comision_por_externos": ["porcentaje"],
  "comisiones.red_desbloqueada": ["umbral"],
  "comisiones.red_bloqueada": ["umbral"],
} as const satisfies Readonly<Record<string, readonly Marcador[]>>;

/**
 * Glosario único de la cotización (Sprint 6a): pantallas y PDF toman de aquí
 * cada término, sin variantes. rendimientoTotal y pagoRendimientoFinal llevan {meses}.
 */
export interface Glosario {
  readonly rendimiento_mensual: string;
  readonly rendimiento_anual: string;
  readonly rendimiento_total: string;
  readonly capital_mas_rendimiento: string;
  readonly pago_rendimiento_mensual: string;
  readonly pago_rendimiento_final: string;
  readonly mensual: string;
  readonly final_del_plazo: string;
  readonly rendimiento_acumulado: string;
  readonly tasa_anual_neta: string;
}

const CLAVES_GLOSARIO = [
  "rendimiento_mensual",
  "rendimiento_anual",
  "rendimiento_total",
  "capital_mas_rendimiento",
  "pago_rendimiento_mensual",
  "pago_rendimiento_final",
  "mensual",
  "final_del_plazo",
  "rendimiento_acumulado",
  "tasa_anual_neta",
] as const satisfies readonly (keyof Glosario)[];

export interface TextosCotizacion {
  readonly version: string;
  readonly glosario: Glosario;
  readonly pieBase: string;
  readonly lineaPreparadoPor: string;
  readonly lineaVigencia: string;
  /** Explicación del estatus del tramo: solo se muestra en pantalla, nunca en el PDF. */
  readonly estatusTramo: Readonly<Record<Estatus, string>>;
  /** Nombre del esquema en el selector de la pantalla (del glosario). */
  readonly nombreEsquema: Readonly<Record<Esquema, string>>;
  /** "Mensual" o "Al final del plazo" (del glosario): el valor de "Esquema" en la página 1 y en la vista previa. */
  readonly esquemaCorto: Readonly<Record<Esquema, string>>;
  readonly monedaDeshabilitada: string;
  /** Disclaimer del fondo, en el pie de las dos páginas del PDF (las dos entidades). */
  readonly pieAvisoFondo: string;
  /** Línea SIPRES, en el pie de las dos páginas del PDF (las dos entidades). */
  readonly pieSipres: string;
  /** "Tasa neta: ya después de impuestos.", en el pie de las dos páginas del PDF. */
  readonly pieNotaNeta: string;
  /** Etiqueta de cada resultado, por esquema (pantalla y PDF), del glosario; la del rendimiento total lleva {meses}. */
  readonly etiquetasResultados: Readonly<Record<Esquema, Readonly<Record<Salida, string>>>>;
  /** Plantilla con {meses}, del glosario: cuándo se paga el rendimiento, por esquema (página 1, página 2 y vista previa). */
  readonly lineaPago: Readonly<Record<Esquema, string>>;
  /** Textos fijos del PDF. */
  readonly pdf: TextosPdf;
  /** Textos fijos de la página 2 del PDF (calendario, gráficas y escenario). */
  readonly pdfPagina2: TextosPagina2;
  /** Modo reclutamiento (/comisiones/reclutamiento y su PDF "Propuesta de ingresos"). */
  readonly reclutamiento: TextosReclutamiento;
  /** Simulador /comisiones (Sprint 6c): tablas de incentivos y Mis externos. */
  readonly comisiones: TextosComisiones;
}

/**
 * Textos del simulador /comisiones que vienen del archivo (Sprint 6c). Las
 * plantillas llevan sus marcadores entre llaves; la pantalla los llena con las
 * cifras del modelo.
 */
export interface TextosComisiones {
  readonly tituloIncentivosExterno: string;
  readonly ayudaIncentivosExterno: string;
  /** Plantilla con {meta}: la meta interna de un ejecutivo, solo como referencia. */
  readonly notaMetaInterna: string;
  readonly tituloMetas: string;
  readonly columnaCumplimiento: string;
  readonly columnaDesde: string;
  readonly columnaHasta: string;
  readonly columnaIncentivo: string;
  /** El "hasta" del último rango. */
  readonly enAdelante: string;
  /** Plantilla con {bono}. */
  readonly incentivoMasComision: string;
  readonly filaAlcanzada: string;
  readonly sueldoBase: string;
  /** Plantilla con {porcentaje} y {umbral}. */
  readonly notaDesbloqueo: string;
  readonly tituloMisExternos: string;
  readonly ayudaMisExternos: string;
  /** Solo GERENTE: dónde capturar cada inversión, para no contarla dos veces. */
  readonly notaDobleCaptura: string;
  /** Plantillas con {n}. */
  readonly inversionExterno: string;
  readonly agregarExterno: string;
  readonly quitarExterno: string;
  readonly supuestoPorConfirmar: string;
  /** Plantilla con {porcentaje}. */
  readonly comisionPorExternos: string;
  readonly basePorExternos: string;
  readonly notaAparte: string;
  /** Plantillas con {umbral}. */
  readonly redDesbloqueada: string;
  readonly redBloqueada: string;
}

/** Clave del archivo (snake_case) -> clave de TextosComisiones. */
const CLAVES_COMISIONES = {
  titulo_incentivos_externo: "tituloIncentivosExterno",
  ayuda_incentivos_externo: "ayudaIncentivosExterno",
  nota_meta_interna: "notaMetaInterna",
  titulo_metas: "tituloMetas",
  columna_cumplimiento: "columnaCumplimiento",
  columna_desde: "columnaDesde",
  columna_hasta: "columnaHasta",
  columna_incentivo: "columnaIncentivo",
  en_adelante: "enAdelante",
  incentivo_mas_comision: "incentivoMasComision",
  fila_alcanzada: "filaAlcanzada",
  sueldo_base: "sueldoBase",
  nota_desbloqueo: "notaDesbloqueo",
  titulo_mis_externos: "tituloMisExternos",
  ayuda_mis_externos: "ayudaMisExternos",
  nota_doble_captura: "notaDobleCaptura",
  inversion_externo: "inversionExterno",
  agregar_externo: "agregarExterno",
  quitar_externo: "quitarExterno",
  supuesto_por_confirmar: "supuestoPorConfirmar",
  comision_por_externos: "comisionPorExternos",
  base_por_externos: "basePorExternos",
  nota_aparte: "notaAparte",
  red_desbloqueada: "redDesbloqueada",
  red_bloqueada: "redBloqueada",
} as const satisfies Readonly<Record<string, keyof TextosComisiones>>;

type ClaveArchivoComisiones = keyof typeof CLAVES_COMISIONES;

/**
 * Textos del modo reclutamiento (Sprint 5: un solo dato, comparativo por
 * plazos y escalera de bonos). Se redactan como cálculo ("se ganaría") o
 * invitación, nunca como promesa. El aviso con {fecha} es fijo y siempre visible.
 */
export interface TextosReclutamiento {
  readonly tituloPagina: string;
  readonly introduccion: string;
  /** "¿Cuánto captarías al mes?": el único dato visible. */
  readonly preguntaMonto: string;
  readonly ayudaMonto: string;
  readonly tituloResultado: string;
  /** Plantillas de la cifra grande: con {captacion}, {meses}, {comision} y {bono}; la de la mezcla, sin {meses}. */
  readonly cifraDetalle: string;
  readonly cifraDetalleMezcla: string;
  readonly tituloComparativo: string;
  readonly ayudaComparativo: string;
  /** Plantilla con {meses}. */
  readonly plazoMeses: string;
  /** Plantilla con {meses_mayor}, {veces} y {meses_menor}. */
  readonly fraseVeces: string;
  readonly tituloBonos: string;
  /** Escalones de la escalera de bonos: con {desde}, {hasta} y {bono}. */
  readonly escalonSinBono: string;
  readonly escalonRango: string;
  readonly escalonUltimo: string;
  /** Marca el escalón de la captación del ejemplo. */
  readonly escalonActual: string;
  /** Aviso exacto que va solo debajo de la escalera de bonos. */
  readonly avisoIncorporacion: string;
  readonly personalizar: string;
  readonly tituloMezcla: string;
  readonly ayudaMezcla: string;
  /** Plantilla con {meses}. */
  readonly montoPlazo: string;
  /** Etiqueta y ayuda del campo "Inversiones por plazo" (entero de 1 a 20). */
  readonly inversionesPorPlazo: string;
  readonly ayudaInversionesPorPlazo: string;
  readonly presenta: string;
  readonly ayudaPresenta: string;
  readonly tituloFechas: string;
  /** Plantillas con {dia_corte}/{dia_siguiente}, {mes} y {fecha_pago}. */
  readonly fechaQuincena1: string;
  readonly fechaQuincena2: string;
  /** Plantilla con {fecha}: la de las tablas vigentes (aprobado por RH). */
  readonly aviso: string;
  /** Plantilla con {n}: cuántas inversiones por plazo se usaron en el cálculo. */
  readonly avisoInversionesPorPlazo: string;
  readonly avisoTasas: string;
  /** Aviso interno de la pantalla mientras RH no apruebe las frases (nunca en el PDF). */
  readonly avisoFrasesRh: string;
  readonly pdfTitulo: string;
  /** Plantilla con {presenta}. */
  readonly pdfPresenta: string;
  readonly pdfFecha: string;
  readonly descargarPdf: string;
  /** Montos de un toque, sin comas ("1000000"). */
  readonly montosEjemplo: readonly string[];
  readonly montoPorOmision: string;
  /** Plazo de la cifra grande por omisión (meses). */
  readonly plazoPorOmision: number;
  /** Frases aspiracionales (pendientes de RH); la primera es la que se usa. Admiten {monto_minimo}. */
  readonly frases: readonly string[];
  readonly frasesAprobadasPorRh: boolean;
}

/** Clave del archivo (snake_case) -> clave de TextosReclutamiento (solo los textos sueltos). */
const CLAVES_RECLUTAMIENTO = {
  titulo_pagina: "tituloPagina",
  introduccion: "introduccion",
  pregunta_monto: "preguntaMonto",
  ayuda_monto: "ayudaMonto",
  titulo_resultado: "tituloResultado",
  cifra_detalle: "cifraDetalle",
  cifra_detalle_mezcla: "cifraDetalleMezcla",
  titulo_comparativo: "tituloComparativo",
  ayuda_comparativo: "ayudaComparativo",
  plazo_meses: "plazoMeses",
  frase_veces: "fraseVeces",
  titulo_bonos: "tituloBonos",
  escalon_sin_bono: "escalonSinBono",
  escalon_rango: "escalonRango",
  escalon_ultimo: "escalonUltimo",
  escalon_actual: "escalonActual",
  aviso_incorporacion: "avisoIncorporacion",
  personalizar: "personalizar",
  titulo_mezcla: "tituloMezcla",
  ayuda_mezcla: "ayudaMezcla",
  monto_plazo: "montoPlazo",
  inversiones_por_plazo: "inversionesPorPlazo",
  ayuda_inversiones_por_plazo: "ayudaInversionesPorPlazo",
  presenta: "presenta",
  ayuda_presenta: "ayudaPresenta",
  titulo_fechas: "tituloFechas",
  fecha_quincena_1: "fechaQuincena1",
  fecha_quincena_2: "fechaQuincena2",
  aviso: "aviso",
  aviso_inversiones_por_plazo: "avisoInversionesPorPlazo",
  aviso_tasas: "avisoTasas",
  aviso_frases_rh: "avisoFrasesRh",
  pdf_titulo: "pdfTitulo",
  pdf_presenta: "pdfPresenta",
  pdf_fecha: "pdfFecha",
  descargar_pdf: "descargarPdf",
} as const satisfies Readonly<
  Record<string, Exclude<keyof TextosReclutamiento, "montosEjemplo" | "montoPorOmision" | "plazoPorOmision" | "frases" | "frasesAprobadasPorRh">>
>;

type ClaveArchivoReclutamiento = keyof typeof CLAVES_RECLUTAMIENTO;

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
  /** "Tasa anual neta" (glosario). */
  readonly tasaAnual: string;
  /** En lugar de tasaAnual en un plazo especial. */
  readonly tasaAcordada: string;
  readonly capitalInicial: string;
  /** Plantilla con {meses} (glosario). */
  readonly rendimientoTotal: string;
  /** "Capital + rendimiento total" (glosario). */
  readonly capitalMasRendimiento: string;
  /** Plantillas con {meses} (glosario): cuándo se paga el rendimiento. */
  readonly pagoRendimientoMensual: string;
  readonly pagoRendimientoFinal: string;
  /** Plantilla con {meses}: cuándo se paga el capital. */
  readonly capitalVencimiento: string;
  /** Rótulos de la franja de tiempo de cada tarjeta. */
  readonly franjaRendimiento: string;
  readonly franjaMasCapital: string;
  readonly franjaRendimientoCapital: string;
  readonly columnaMes: string;
  /** Encabezados de la tabla mensual (glosario). */
  readonly columnaRendimientoMensual: string;
  readonly columnaRendimientoAcumulado: string;
  /** Marca la modalidad de la cotización. */
  readonly insignia: string;
  readonly notaCentavos: string;
  /** Reemplaza la tarjeta de una modalidad que no se puede cotizar. */
  readonly modalidadNoDisponible: string;
  /** Reemplaza la tarjeta de una modalidad sin tasa acordada (plazo especial). */
  readonly modalidadSinTasa: string;
  readonly tituloGrafica1: string;
  readonly notaGrafica1: string;
  /** Leyendas de la gráfica de comparación (glosario): "Mensual" y "Al final del plazo". */
  readonly serieMensual: string;
  readonly serieFinal: string;
  /** Reemplaza la gráfica de comparación si falta la tasa de una modalidad. */
  readonly comparacionOmitida: string;
  /** Comparativo de tasas (seed/benchmark.json). */
  readonly benchmarkTitulo: string;
  /** Rótulo de la barra de la tasa cotizada. */
  readonly benchmarkTuTasa: string;
  /** Plantilla con {fecha}: la leyenda general del comparativo, con la fecha de actualización. */
  readonly benchmarkActualizado: string;
  /** Plantilla con {fuentes}: los nombres cortos de las fuentes. */
  readonly benchmarkFuentes: string;
  /** Reemplaza al comparativo si los datos pasan de la antigüedad máxima. */
  readonly benchmarkDesactualizado: string;
  /** Reemplaza al comparativo en una cotización en dólares. */
  readonly benchmarkSoloPesos: string;
  /** Junto a la fecha de un instrumento en dólares (S&P 500). */
  readonly benchmarkEnDolares: string;
  /** La tasa de Crediflexi es neta y las demás, brutas. */
  readonly benchmarkNotaNeta: string;
  /** "Página" y "de", para el pie "Página 1 de 2". */
  readonly pagina: string;
  readonly paginaDe: string;
}

/** Los textos de TextosPagina2 que salen del glosario y no del bloque pdf_pagina2. */
type DelGlosarioPagina2 =
  | "tasaAnual"
  | "rendimientoTotal"
  | "capitalMasRendimiento"
  | "pagoRendimientoMensual"
  | "pagoRendimientoFinal"
  | "columnaRendimientoMensual"
  | "columnaRendimientoAcumulado"
  | "serieMensual"
  | "serieFinal";

/** Clave del archivo (snake_case) -> clave de TextosPagina2. */
const CLAVES_PAGINA2 = {
  titulo: "titulo",
  modalidad_1: "modalidad1",
  modalidad_2: "modalidad2",
  tasa_acordada: "tasaAcordada",
  capital_inicial: "capitalInicial",
  capital_vencimiento: "capitalVencimiento",
  franja_rendimiento: "franjaRendimiento",
  franja_mas_capital: "franjaMasCapital",
  franja_rendimiento_capital: "franjaRendimientoCapital",
  columna_mes: "columnaMes",
  insignia: "insignia",
  nota_centavos: "notaCentavos",
  modalidad_no_disponible: "modalidadNoDisponible",
  modalidad_sin_tasa: "modalidadSinTasa",
  titulo_grafica_1: "tituloGrafica1",
  nota_grafica_1: "notaGrafica1",
  comparacion_omitida: "comparacionOmitida",
  benchmark_titulo: "benchmarkTitulo",
  benchmark_tu_tasa: "benchmarkTuTasa",
  benchmark_actualizado: "benchmarkActualizado",
  benchmark_fuentes: "benchmarkFuentes",
  benchmark_desactualizado: "benchmarkDesactualizado",
  benchmark_solo_pesos: "benchmarkSoloPesos",
  benchmark_en_dolares: "benchmarkEnDolares",
  benchmark_nota_neta: "benchmarkNotaNeta",
  pagina: "pagina",
  pagina_de: "paginaDe",
} as const satisfies Readonly<Record<string, Exclude<keyof TextosPagina2, DelGlosarioPagina2>>>;

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

/** Monto de ejemplo: sin comas, con máximo 2 decimales y mayor que cero. */
const montoSinComas = z.string().regex(/^(?!0+(\.0+)?$)\d+(\.\d{1,2})?$/, {
  error: 'El monto va sin comas, con máximo 2 decimales y mayor que cero (por ejemplo "1000000").',
});

function claveDesconocida(iss: { code: string; keys?: readonly string[] }): string | undefined {
  if (iss.code !== "unrecognized_keys" || iss.keys === undefined) return undefined;
  return `Clave desconocida: ${iss.keys.map((k) => `"${k}"`).join(", ")}. Revisa que esté bien escrita o quítala.`;
}

const esquemaTextos = z
  .strictObject(
    {
      version: z.string({ error: "Falta la versión del archivo (texto)." }).trim().min(1),
      glosario: z.strictObject(
        Object.fromEntries(
          CLAVES_GLOSARIO.map((clave) => {
            const campo = `glosario.${clave}`;
            const permitidos = (MARCADORES_POR_CAMPO as Readonly<Record<string, readonly Marcador[]>>)[campo] ?? [];
            return [clave, texto(campo, permitidos)];
          }),
        ) as Record<keyof Glosario, ReturnType<typeof texto>>,
        { error: claveDesconocida },
      ),
      detalle_pago_mensual: texto("detalle_pago_mensual", MARCADORES_POR_CAMPO.detalle_pago_mensual),
      nota_mensual_al_final: texto("nota_mensual_al_final"),
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
      moneda_deshabilitada: texto("moneda_deshabilitada", MARCADORES_POR_CAMPO.moneda_deshabilitada),
      pie_aviso_fondo: texto("pie_aviso_fondo"),
      pie_sipres: texto("pie_sipres"),
      pie_nota_neta: texto("pie_nota_neta"),
      pdf: z.strictObject(
        {
          titulo: texto("pdf.titulo"),
          preparado_para: texto("pdf.preparado_para"),
          fecha: texto("pdf.fecha"),
          resumen_monto: texto("pdf.resumen_monto"),
          resumen_plazo: texto("pdf.resumen_plazo"),
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
      reclutamiento: z.strictObject(
        {
          ...(Object.fromEntries(
            Object.keys(CLAVES_RECLUTAMIENTO).map((clave) => {
              const campo = `reclutamiento.${clave}`;
              const permitidos = (MARCADORES_POR_CAMPO as Readonly<Record<string, readonly Marcador[]>>)[campo] ?? [];
              return [clave, texto(campo, permitidos)];
            }),
          ) as Record<ClaveArchivoReclutamiento, ReturnType<typeof texto>>),
          montos_ejemplo: z.array(montoSinComas).min(1, { error: "Pon al menos un monto de ejemplo." }),
          monto_por_omision: montoSinComas,
          plazo_por_omision: z.string().regex(/^[1-9]\d*$/, { error: 'El plazo va en meses, como texto (por ejemplo "12").' }),
          frases: z.array(texto("reclutamiento.frases", MARCADORES_POR_CAMPO["reclutamiento.frases"])).min(1, { error: "Pon al menos una frase." }),
          frases_aprobadas_por_rh: z.boolean({ error: "Debe ser true o false." }),
        },
        { error: claveDesconocida },
      ),
      comisiones: z.strictObject(
        Object.fromEntries(
          Object.keys(CLAVES_COMISIONES).map((clave) => {
            const campo = `comisiones.${clave}`;
            const permitidos = (MARCADORES_POR_CAMPO as Readonly<Record<string, readonly Marcador[]>>)[campo] ?? [];
            return [clave, texto(campo, permitidos)];
          }),
        ) as Record<ClaveArchivoComisiones, ReturnType<typeof texto>>,
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
  .transform((t): TextosCotizacion => {
    const g = t.glosario;
    const esquemas = { mensual: g.mensual, final_del_plazo: g.final_del_plazo };
    const lineaPago = { mensual: `${g.pago_rendimiento_mensual}: ${t.detalle_pago_mensual}`, final_del_plazo: g.pago_rendimiento_final };
    const etiquetas = (mensual: string) => ({
      rendimiento_mensual_pesos: mensual,
      rendimiento_anual_pesos: g.rendimiento_anual,
      ganancia_total_plazo: g.rendimiento_total,
    });
    return {
      version: t.version,
      glosario: g,
      pieBase: t.pie_base,
      lineaPreparadoPor: t.linea_preparado_por,
      lineaVigencia: t.linea_vigencia,
      estatusTramo: t.estatus_tramo,
      nombreEsquema: esquemas,
      esquemaCorto: esquemas,
      monedaDeshabilitada: t.moneda_deshabilitada,
      pieAvisoFondo: t.pie_aviso_fondo,
      pieSipres: t.pie_sipres,
      pieNotaNeta: t.pie_nota_neta,
      etiquetasResultados: {
        mensual: etiquetas(g.rendimiento_mensual),
        final_del_plazo: etiquetas(`${g.rendimiento_mensual}, ${t.nota_mensual_al_final}`),
      },
      lineaPago,
      pdf: {
        titulo: t.pdf.titulo,
        preparadoPara: t.pdf.preparado_para,
        fecha: t.pdf.fecha,
        resumenMonto: t.pdf.resumen_monto,
        resumenPlazo: t.pdf.resumen_plazo,
        resumenTasa: g.tasa_anual_neta,
        resumenEsquema: t.pdf.resumen_esquema,
        seccionResultados: t.pdf.seccion_resultados,
        seccionCalculo: t.pdf.seccion_calculo,
        lineaTasas: t.pdf.linea_tasas,
        plazoEspecial: t.pdf.plazo_especial,
        tasaAcordada: t.pdf.tasa_acordada,
        desglosePuntos: t.pdf.desglose_puntos,
      },
      pdfPagina2: {
        ...(Object.fromEntries(
          (Object.entries(CLAVES_PAGINA2) as [ClaveArchivoPagina2, keyof TextosPagina2][]).map(([archivo, clave]) => [clave, t.pdf_pagina2[archivo]]),
        ) as unknown as Omit<TextosPagina2, DelGlosarioPagina2>),
        tasaAnual: g.tasa_anual_neta,
        rendimientoTotal: g.rendimiento_total,
        capitalMasRendimiento: g.capital_mas_rendimiento,
        pagoRendimientoMensual: lineaPago.mensual,
        pagoRendimientoFinal: lineaPago.final_del_plazo,
        columnaRendimientoMensual: g.rendimiento_mensual,
        columnaRendimientoAcumulado: g.rendimiento_acumulado,
        serieMensual: g.mensual,
        serieFinal: g.final_del_plazo,
      },
      reclutamiento: {
        ...(Object.fromEntries(
          (Object.entries(CLAVES_RECLUTAMIENTO) as [ClaveArchivoReclutamiento, string][]).map(([archivo, clave]) => [clave, t.reclutamiento[archivo]]),
        ) as unknown as Omit<TextosReclutamiento, "montosEjemplo" | "montoPorOmision" | "plazoPorOmision" | "frases" | "frasesAprobadasPorRh">),
        montosEjemplo: t.reclutamiento.montos_ejemplo,
        montoPorOmision: t.reclutamiento.monto_por_omision,
        plazoPorOmision: Number(t.reclutamiento.plazo_por_omision),
        frases: t.reclutamiento.frases,
        frasesAprobadasPorRh: t.reclutamiento.frases_aprobadas_por_rh,
      },
      comisiones: Object.fromEntries(
        (Object.entries(CLAVES_COMISIONES) as [ClaveArchivoComisiones, keyof TextosComisiones][]).map(([archivo, clave]) => [clave, t.comisiones[archivo]]),
      ) as unknown as TextosComisiones,
    };
  });

/**
 * Valida los textos de la cotización y los convierte a la forma de la
 * aplicación. Es pura: recibe el objeto ya leído y el nombre del archivo para
 * los mensajes.
 */
export function cargarTextos(json: unknown, archivo: string): ResultadoApp<TextosCotizacion> {
  return validar(esquemaTextos, json, "TEXTOS_INVALIDOS", archivo);
}
