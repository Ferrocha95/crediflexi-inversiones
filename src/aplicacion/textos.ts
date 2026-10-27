import * as z from "zod";
import { listaEnEspanol } from "../domain/comun/formato";
import type { Esquema, Estatus, Salida } from "../domain/tasas/semilla.esquema";
import { validar, type ResultadoApp } from "./resultado";

/** Marcadores que se pueden usar en seed/textos_cotizacion.json. */
export const MARCADORES = [
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
  "falta",
  "nota",
  "dia_pago",
  "dia_pago_siguiente",
  "lista",
  "sueldo",
] as const;
export type Marcador = (typeof MARCADORES)[number];

/**
 * Marcadores permitidos en cada campo; los de estatus_tramo, el resto del
 * glosario, el resto del bloque pdf y el resto de pdf_pagina2 no admiten ninguno.
 */
export const MARCADORES_POR_CAMPO = {
  linea_preparado_por: ["ejecutivo"],
  linea_vigencia: ["vigencia"],
  moneda_deshabilitada: ["moneda"],
  "pdf.linea_tasas": ["version_tasas", "fecha_tasas"],
  "pdf.desglose_puntos": ["tasa_tabla", "puntos", "tasa"],
  "pdf.fecha_inicio": ["fecha"],
  "glosario.rendimiento_total": ["meses"],
  "glosario.pago_rendimiento_final": ["meses"],
  detalle_pago_mensual: ["meses"],
  "pdf_pagina2.capital_vencimiento": ["meses"],
  "pdf_pagina2.vencimiento": ["fecha"],
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
  "reclutamiento.cifra_detalle_interno": ["captacion", "meses", "sueldo", "comision", "bono"],
  "reclutamiento.cifra_detalle_interno_mezcla": ["captacion", "sueldo", "comision", "bono"],
  "reclutamiento.nota_desbloqueo_interno": ["porcentaje", "umbral"],
  "reclutamiento.interno_bloqueada": ["falta", "umbral"],
  "comisiones.nota_meta_interna": ["meta"],
  "comisiones.incentivo_mas_comision": ["bono"],
  "comisiones.nota_desbloqueo": ["porcentaje", "umbral"],
  "comisiones.inversion_externo": ["n"],
  "comisiones.quitar_externo": ["n"],
  "comisiones.comision_por_externos": ["porcentaje"],
  "comisiones.red_desbloqueada": ["umbral"],
  "comisiones.red_bloqueada": ["umbral"],
  "comisiones.pdf_avance": ["porcentaje", "captacion", "meta"],
  "comisiones.pdf_marca_umbral": ["porcentaje", "umbral"],
  "comisiones.pdf_marca_meta": ["meta"],
  "comisiones.pdf_desbloqueada_el": ["fecha"],
  "comisiones.pdf_falta_umbral": ["falta", "umbral"],
  "comisiones.pdf_falta_meta": ["falta"],
  "comisiones.pdf_regla_cierre": ["nota"],
  "comisiones.pdf_regla_quincenas": ["dia_corte", "dia_pago", "dia_siguiente", "dia_pago_siguiente"],
  "comisiones.pdf_regla_interno": ["dia_corte", "dia_pago_siguiente"],
  "comisiones.pdf_pago_inversiones": ["lista"],
  "comisiones.pdf_pago_inversion": ["n"],
} as const satisfies Readonly<Record<string, readonly Marcador[]>>;

/**
 * Glosario único de la cotización (Sprint 6a): pantallas y PDF toman de aquí
 * cada término, sin variantes. rendimientoTotal y pagoRendimientoFinal llevan {meses}.
 */
export interface Glosario {
  readonly rendimiento_mensual: string;
  /** Página 1 (Sprint 6b): monto × tasa ÷ 12, como promedio; la tabla mensual sigue con rendimiento_mensual. */
  readonly rendimiento_mensual_promedio: string;
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
  "rendimiento_mensual_promedio",
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
  readonly lineaPreparadoPor: string;
  readonly lineaVigencia: string;
  /** Explicación del estatus del tramo: solo se muestra en pantalla, nunca en el PDF. */
  readonly estatusTramo: Readonly<Record<Estatus, string>>;
  /** Nombre del esquema en el selector de la pantalla (del glosario). */
  readonly nombreEsquema: Readonly<Record<Esquema, string>>;
  /** "Mensual" o "Al final del plazo" (del glosario): el valor de "Esquema" en la página 1 y en la vista previa. */
  readonly esquemaCorto: Readonly<Record<Esquema, string>>;
  readonly monedaDeshabilitada: string;
  /** Pie de la cotización (Sprint 7a: con "Cotización con tasas netas"), en las dos páginas del PDF (las dos entidades). */
  readonly pieAvisoFondo: string;
  /** Línea SIPRES, en el pie de las dos páginas del PDF (las dos entidades). */
  readonly pieSipres: string;
  /** Franja fija del marco y de /acceso con ENTORNO distinto de "produccion" (Sprint 8a). No va en los PDF. */
  readonly avisoEntornoPrueba: string;
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
  /** Pantalla /biblioteca (Sprint 7b). */
  readonly biblioteca: TextosBiblioteca;
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
  /** Plantilla con {porcentaje}. */
  readonly comisionPorExternos: string;
  readonly basePorExternos: string;
  readonly notaAparte: string;
  /** Plantillas con {umbral}. */
  readonly redDesbloqueada: string;
  readonly redBloqueada: string;
  /** Sprint 7a: "Total estimado del mes (simulación)" = sueldo base + comisión pagable + bono (pantalla y PDF). */
  readonly totalEstimadoMes: string;
  readonly totalComisionPagable: string;
  readonly totalBono: string;
  readonly descargarPdf: string;
  /** Aviso fijo del PDF de comisiones (sin marcadores). */
  readonly avisoPdf: string;
  // PDF de comisiones (Sprint 7a): rótulos fijos y plantillas.
  readonly pdfTitulo: string;
  readonly pdfFecha: string;
  readonly pdfPerfil: string;
  readonly pdfRol: string;
  readonly pdfInterno: string;
  readonly pdfEjecutivo: string;
  readonly pdfGerente: string;
  readonly pdfTituloTabla: string;
  readonly pdfColumnaNumero: string;
  readonly pdfColumnaTipo: string;
  readonly pdfColumnaFecha: string;
  readonly pdfColumnaMonto: string;
  readonly pdfColumnaPlazo: string;
  readonly pdfColumnaTasa: string;
  readonly pdfColumnaComision: string;
  readonly pdfColumnaPago: string;
  readonly pdfNueva: string;
  readonly pdfRenovacion: string;
  readonly pdfSinPago: string;
  readonly pdfNoCuentaParaMeta: string;
  readonly pdfComisionDelMes: string;
  readonly pdfComisionPagable: string;
  readonly pdfComisionBloqueada: string;
  readonly pdfCaptacionParaMeta: string;
  readonly pdfTituloAvance: string;
  readonly pdfDesbloqueada: string;
  readonly pdfBloqueada: string;
  /** Plantillas con {porcentaje}, {captacion}, {meta}, {umbral}, {fecha}, {falta} o {nota}. */
  readonly pdfAvance: string;
  readonly pdfMarcaUmbral: string;
  readonly pdfMarcaMeta: string;
  readonly pdfDesbloqueadaEl: string;
  readonly pdfFaltaUmbral: string;
  readonly pdfFaltaMeta: string;
  readonly pdfMetaCumplida: string;
  readonly pdfReglaCierre: string;
  readonly pdfSinBonoGerente: string;
  readonly pdfFechaIncentivos: string;
  readonly pdfBonoGerente: string;
  readonly pdfBaseBonoGerente: string;
  readonly pdfAyudaBonoGerente: string;
  readonly pdfCalculo: string;
  readonly pdfTituloCalendario: string;
  /** Plantillas con los días del calendario de la semilla. */
  readonly pdfReglaQuincenas: string;
  readonly pdfReglaInterno: string;
  readonly pdfSinPagos: string;
  /** Plantillas con {lista} y {n}. */
  readonly pdfPagoInversiones: string;
  readonly pdfPagoInversion: string;
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
  comision_por_externos: "comisionPorExternos",
  base_por_externos: "basePorExternos",
  nota_aparte: "notaAparte",
  red_desbloqueada: "redDesbloqueada",
  red_bloqueada: "redBloqueada",
  total_estimado_mes: "totalEstimadoMes",
  total_comision_pagable: "totalComisionPagable",
  total_bono: "totalBono",
  descargar_pdf: "descargarPdf",
  aviso_pdf: "avisoPdf",
  pdf_titulo: "pdfTitulo",
  pdf_fecha: "pdfFecha",
  pdf_perfil: "pdfPerfil",
  pdf_rol: "pdfRol",
  pdf_interno: "pdfInterno",
  pdf_ejecutivo: "pdfEjecutivo",
  pdf_gerente: "pdfGerente",
  pdf_titulo_tabla: "pdfTituloTabla",
  pdf_columna_numero: "pdfColumnaNumero",
  pdf_columna_tipo: "pdfColumnaTipo",
  pdf_columna_fecha: "pdfColumnaFecha",
  pdf_columna_monto: "pdfColumnaMonto",
  pdf_columna_plazo: "pdfColumnaPlazo",
  pdf_columna_tasa: "pdfColumnaTasa",
  pdf_columna_comision: "pdfColumnaComision",
  pdf_columna_pago: "pdfColumnaPago",
  pdf_nueva: "pdfNueva",
  pdf_renovacion: "pdfRenovacion",
  pdf_sin_pago: "pdfSinPago",
  pdf_no_cuenta_para_meta: "pdfNoCuentaParaMeta",
  pdf_comision_del_mes: "pdfComisionDelMes",
  pdf_comision_pagable: "pdfComisionPagable",
  pdf_comision_bloqueada: "pdfComisionBloqueada",
  pdf_captacion_para_meta: "pdfCaptacionParaMeta",
  pdf_titulo_avance: "pdfTituloAvance",
  pdf_desbloqueada: "pdfDesbloqueada",
  pdf_bloqueada: "pdfBloqueada",
  pdf_avance: "pdfAvance",
  pdf_marca_umbral: "pdfMarcaUmbral",
  pdf_marca_meta: "pdfMarcaMeta",
  pdf_desbloqueada_el: "pdfDesbloqueadaEl",
  pdf_falta_umbral: "pdfFaltaUmbral",
  pdf_falta_meta: "pdfFaltaMeta",
  pdf_meta_cumplida: "pdfMetaCumplida",
  pdf_regla_cierre: "pdfReglaCierre",
  pdf_sin_bono_gerente: "pdfSinBonoGerente",
  pdf_fecha_incentivos: "pdfFechaIncentivos",
  pdf_bono_gerente: "pdfBonoGerente",
  pdf_base_bono_gerente: "pdfBaseBonoGerente",
  pdf_ayuda_bono_gerente: "pdfAyudaBonoGerente",
  pdf_calculo: "pdfCalculo",
  pdf_titulo_calendario: "pdfTituloCalendario",
  pdf_regla_quincenas: "pdfReglaQuincenas",
  pdf_regla_interno: "pdfReglaInterno",
  pdf_sin_pagos: "pdfSinPagos",
  pdf_pago_inversiones: "pdfPagoInversiones",
  pdf_pago_inversion: "pdfPagoInversion",
} as const satisfies Readonly<Record<string, keyof TextosComisiones>>;

type ClaveArchivoComisiones = keyof typeof CLAVES_COMISIONES;

/**
 * Textos de la pantalla /biblioteca (Sprint 7b, textos 0.15; subcarpetas en el
 * Sprint 7c, textos 0.16). Sin marcadores.
 * Las cuatro categorías llegan juntas en `categorias`, con la clave del enum
 * de la base.
 */
export interface TextosBiblioteca {
  readonly categorias: Readonly<Record<"HERRAMIENTAS" | "MULTIMEDIA" | "EMPRESA" | "CAPACITACION", string>>;
  readonly tituloPagina: string;
  readonly intro: string;
  readonly buscar: string;
  readonly ayudaBuscar: string;
  readonly sinResultados: string;
  readonly categoriaVacia: string;
  readonly bibliotecaVacia: string;
  readonly bibliotecaVaciaEjecutivo: string;
  readonly bibliotecaVaciaAdministrador: string;
  readonly subirArchivo: string;
  readonly agregarEnlace: string;
  readonly archivar: string;
  readonly ver: string;
  readonly descargar: string;
  readonly abrirEnlace: string;
  readonly nuevaPestana: string;
  readonly tipoEnlace: string;
  readonly etiquetaTipo: string;
  readonly etiquetaTamano: string;
  readonly etiquetaFecha: string;
  readonly etiquetaSubidoPor: string;
  readonly etiquetaArchivado: string;
  readonly verArchivados: string;
  readonly verActivos: string;
  readonly tituloArchivados: string;
  readonly introArchivados: string;
  readonly sinArchivados: string;
  readonly campoArchivo: string;
  readonly ayudaArchivo: string;
  readonly campoNombre: string;
  readonly ayudaNombreArchivo: string;
  readonly campoDescripcion: string;
  readonly campoCategoria: string;
  readonly eligeCategoria: string;
  readonly campoEnlace: string;
  readonly ayudaEnlace: string;
  readonly confirmacion: string;
  readonly tituloAvisoCuentas: string;
  readonly avisoCuentas: string;
  readonly subir: string;
  readonly agregar: string;
  readonly cancelar: string;
  readonly cerrar: string;
  readonly subiendo: string;
  readonly tituloArchivar: string;
  readonly textoArchivar: string;
  readonly notificacionSubido: string;
  readonly notificacionEnlace: string;
  readonly notificacionArchivado: string;
  readonly tituloError: string;
  readonly tituloErrorLectura: string;
  readonly fallaRed: string;
  readonly sinCarpeta: string;
  readonly sinCarpetaVacio: string;
  readonly carpetaVacia: string;
  readonly etiquetaNumeroElementos: string;
  readonly etiquetaCarpetaArchivada: string;
  readonly nuevaCarpeta: string;
  readonly etiquetaSeccion: string;
  readonly campoNombreCarpeta: string;
  readonly ayudaNombreCarpeta: string;
  readonly crear: string;
  readonly archivarCarpeta: string;
  readonly explicacionCarpetaNoVacia: string;
  readonly tituloArchivarCarpeta: string;
  readonly textoArchivarCarpeta: string;
  readonly moverA: string;
  readonly tituloMover: string;
  readonly campoCarpeta: string;
  readonly ayudaCarpeta: string;
  readonly ayudaCarpetaMover: string;
  readonly eligeCategoriaPrimero: string;
  readonly mover: string;
  readonly notificacionCarpetaCreada: string;
  readonly notificacionCarpetaArchivada: string;
  readonly notificacionMovido: string;
}

const CLAVES_BIBLIOTECA = {
  titulo_pagina: "tituloPagina",
  intro: "intro",
  buscar: "buscar",
  ayuda_buscar: "ayudaBuscar",
  sin_resultados: "sinResultados",
  categoria_vacia: "categoriaVacia",
  biblioteca_vacia: "bibliotecaVacia",
  biblioteca_vacia_ejecutivo: "bibliotecaVaciaEjecutivo",
  biblioteca_vacia_administrador: "bibliotecaVaciaAdministrador",
  subir_archivo: "subirArchivo",
  agregar_enlace: "agregarEnlace",
  archivar: "archivar",
  ver: "ver",
  descargar: "descargar",
  abrir_enlace: "abrirEnlace",
  nueva_pestana: "nuevaPestana",
  tipo_enlace: "tipoEnlace",
  etiqueta_tipo: "etiquetaTipo",
  etiqueta_tamano: "etiquetaTamano",
  etiqueta_fecha: "etiquetaFecha",
  etiqueta_subido_por: "etiquetaSubidoPor",
  etiqueta_archivado: "etiquetaArchivado",
  ver_archivados: "verArchivados",
  ver_activos: "verActivos",
  titulo_archivados: "tituloArchivados",
  intro_archivados: "introArchivados",
  sin_archivados: "sinArchivados",
  campo_archivo: "campoArchivo",
  ayuda_archivo: "ayudaArchivo",
  campo_nombre: "campoNombre",
  ayuda_nombre_archivo: "ayudaNombreArchivo",
  campo_descripcion: "campoDescripcion",
  campo_categoria: "campoCategoria",
  elige_categoria: "eligeCategoria",
  campo_enlace: "campoEnlace",
  ayuda_enlace: "ayudaEnlace",
  confirmacion: "confirmacion",
  titulo_aviso_cuentas: "tituloAvisoCuentas",
  aviso_cuentas: "avisoCuentas",
  subir: "subir",
  agregar: "agregar",
  cancelar: "cancelar",
  cerrar: "cerrar",
  subiendo: "subiendo",
  titulo_archivar: "tituloArchivar",
  texto_archivar: "textoArchivar",
  notificacion_subido: "notificacionSubido",
  notificacion_enlace: "notificacionEnlace",
  notificacion_archivado: "notificacionArchivado",
  titulo_error: "tituloError",
  titulo_error_lectura: "tituloErrorLectura",
  falla_red: "fallaRed",
  sin_carpeta: "sinCarpeta",
  sin_carpeta_vacio: "sinCarpetaVacio",
  carpeta_vacia: "carpetaVacia",
  etiqueta_numero_elementos: "etiquetaNumeroElementos",
  etiqueta_carpeta_archivada: "etiquetaCarpetaArchivada",
  nueva_carpeta: "nuevaCarpeta",
  etiqueta_seccion: "etiquetaSeccion",
  campo_nombre_carpeta: "campoNombreCarpeta",
  ayuda_nombre_carpeta: "ayudaNombreCarpeta",
  crear: "crear",
  archivar_carpeta: "archivarCarpeta",
  explicacion_carpeta_no_vacia: "explicacionCarpetaNoVacia",
  titulo_archivar_carpeta: "tituloArchivarCarpeta",
  texto_archivar_carpeta: "textoArchivarCarpeta",
  mover_a: "moverA",
  titulo_mover: "tituloMover",
  campo_carpeta: "campoCarpeta",
  ayuda_carpeta: "ayudaCarpeta",
  ayuda_carpeta_mover: "ayudaCarpetaMover",
  elige_categoria_primero: "eligeCategoriaPrimero",
  mover: "mover",
  notificacion_carpeta_creada: "notificacionCarpetaCreada",
  notificacion_carpeta_archivada: "notificacionCarpetaArchivada",
  notificacion_movido: "notificacionMovido",
} as const satisfies Readonly<Record<string, Exclude<keyof TextosBiblioteca, "categorias">>>;

type ClaveArchivoBiblioteca = keyof typeof CLAVES_BIBLIOTECA;

/** Nombre de cada categoría en el archivo → clave del enum categoria_biblioteca. */
const CATEGORIAS_BIBLIOTECA = {
  categoria_herramientas: "HERRAMIENTAS",
  categoria_multimedia: "MULTIMEDIA",
  categoria_empresa: "EMPRESA",
  categoria_capacitacion: "CAPACITACION",
} as const;

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
  // Reclutamiento para internos (Sprint 7a).
  readonly perfil: string;
  readonly perfilInterno: string;
  readonly perfilExterno: string;
  readonly tituloPaginaInterno: string;
  readonly introduccionInterno: string;
  readonly tituloResultadoInterno: string;
  /** Plantillas de la cifra del interno: con {captacion}, {meses}, {sueldo}, {comision} y {bono}; la de la mezcla, sin {meses}. */
  readonly cifraDetalleInterno: string;
  readonly cifraDetalleInternoMezcla: string;
  readonly sueldoBaseInterno: string;
  readonly comisionInterno: string;
  readonly bonoInterno: string;
  readonly calculo: string;
  /** Plantilla con {porcentaje} y {umbral}. */
  readonly notaDesbloqueoInterno: string;
  readonly internoDesbloqueada: string;
  /** Plantilla con {falta} y {umbral}. */
  readonly internoBloqueada: string;
  readonly comparativoBloqueada: string;
  readonly tituloBonosInterno: string;
  readonly columnaCumplimiento: string;
  readonly columnaDesde: string;
  readonly columnaHasta: string;
  readonly columnaBono: string;
  readonly enAdelante: string;
  /** Mientras sea falsa, la pantalla (nunca el PDF) avisa que los textos para internos esperan a RH. */
  readonly frasesInternasAprobadasPorRh: boolean;
  readonly avisoFrasesInternasRh: string;
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
  perfil: "perfil",
  perfil_interno: "perfilInterno",
  perfil_externo: "perfilExterno",
  titulo_pagina_interno: "tituloPaginaInterno",
  introduccion_interno: "introduccionInterno",
  titulo_resultado_interno: "tituloResultadoInterno",
  cifra_detalle_interno: "cifraDetalleInterno",
  cifra_detalle_interno_mezcla: "cifraDetalleInternoMezcla",
  sueldo_base_interno: "sueldoBaseInterno",
  comision_interno: "comisionInterno",
  bono_interno: "bonoInterno",
  calculo: "calculo",
  nota_desbloqueo_interno: "notaDesbloqueoInterno",
  interno_desbloqueada: "internoDesbloqueada",
  interno_bloqueada: "internoBloqueada",
  comparativo_bloqueada: "comparativoBloqueada",
  titulo_bonos_interno: "tituloBonosInterno",
  columna_cumplimiento: "columnaCumplimiento",
  columna_desde: "columnaDesde",
  columna_hasta: "columnaHasta",
  columna_bono: "columnaBono",
  en_adelante: "enAdelante",
  aviso_frases_internas_rh: "avisoFrasesInternasRh",
} as const satisfies Readonly<
  Record<
    string,
    Exclude<
      keyof TextosReclutamiento,
      "montosEjemplo" | "montoPorOmision" | "plazoPorOmision" | "frases" | "frasesAprobadasPorRh" | "frasesInternasAprobadasPorRh"
    >
  >
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
  /** Plantilla con {fecha} (fecha larga): va después del nombre del inversionista en la página 1. */
  readonly fechaInicio: string;
  /** Nota de la página 1: los rendimientos se calculan a días naturales. */
  readonly notaDiasNaturales: string;
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
  /** Título del eje de la gráfica (número de pago). */
  readonly columnaMes: string;
  /** Encabezados de la tabla mensual por fechas (Sprint 6b). */
  readonly columnaFechaPago: string;
  readonly columnaDias: string;
  /** Plantilla con {fecha} (DD/MM/AAAA): la fecha del último pago, en las dos tarjetas. */
  readonly vencimiento: string;
  /** Debajo de la tabla mensual: los días inhábiles no se calculan. */
  readonly notaDiaInhabil: string;
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
  columna_fecha_pago: "columnaFechaPago",
  columna_dias: "columnaDias",
  vencimiento: "vencimiento",
  nota_dia_inhabil: "notaDiaInhabil",
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
          message: "Hay una llave { o } sin cerrar. Cada marcador se escribe entre llaves, por ejemplo {meses}.",
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
      aviso_entorno_prueba: texto("aviso_entorno_prueba"),
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
          fecha_inicio: texto("pdf.fecha_inicio", MARCADORES_POR_CAMPO["pdf.fecha_inicio"]),
          nota_dias_naturales: texto("pdf.nota_dias_naturales"),
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
          frases_internas_aprobadas_por_rh: z.boolean({ error: "Debe ser true o false." }),
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
      biblioteca: z.strictObject(
        Object.fromEntries(
          [...Object.keys(CLAVES_BIBLIOTECA), ...Object.keys(CATEGORIAS_BIBLIOTECA)].map((clave) => [clave, texto(`biblioteca.${clave}`)]),
        ) as Record<ClaveArchivoBiblioteca | keyof typeof CATEGORIAS_BIBLIOTECA, ReturnType<typeof texto>>,
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
      lineaPreparadoPor: t.linea_preparado_por,
      lineaVigencia: t.linea_vigencia,
      estatusTramo: t.estatus_tramo,
      nombreEsquema: esquemas,
      esquemaCorto: esquemas,
      monedaDeshabilitada: t.moneda_deshabilitada,
      pieAvisoFondo: t.pie_aviso_fondo,
      pieSipres: t.pie_sipres,
      avisoEntornoPrueba: t.aviso_entorno_prueba,
      etiquetasResultados: {
        mensual: etiquetas(g.rendimiento_mensual_promedio),
        final_del_plazo: etiquetas(`${g.rendimiento_mensual_promedio}, ${t.nota_mensual_al_final}`),
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
        fechaInicio: t.pdf.fecha_inicio,
        notaDiasNaturales: t.pdf.nota_dias_naturales,
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
        ) as unknown as Omit<
          TextosReclutamiento,
          "montosEjemplo" | "montoPorOmision" | "plazoPorOmision" | "frases" | "frasesAprobadasPorRh" | "frasesInternasAprobadasPorRh"
        >),
        montosEjemplo: t.reclutamiento.montos_ejemplo,
        montoPorOmision: t.reclutamiento.monto_por_omision,
        plazoPorOmision: Number(t.reclutamiento.plazo_por_omision),
        frases: t.reclutamiento.frases,
        frasesAprobadasPorRh: t.reclutamiento.frases_aprobadas_por_rh,
        frasesInternasAprobadasPorRh: t.reclutamiento.frases_internas_aprobadas_por_rh,
      },
      comisiones: Object.fromEntries(
        (Object.entries(CLAVES_COMISIONES) as [ClaveArchivoComisiones, keyof TextosComisiones][]).map(([archivo, clave]) => [clave, t.comisiones[archivo]]),
      ) as unknown as TextosComisiones,
      biblioteca: {
        ...(Object.fromEntries(
          (Object.entries(CLAVES_BIBLIOTECA) as [ClaveArchivoBiblioteca, string][]).map(([archivo, clave]) => [clave, t.biblioteca[archivo]]),
        ) as unknown as Omit<TextosBiblioteca, "categorias">),
        categorias: Object.fromEntries(
          (Object.entries(CATEGORIAS_BIBLIOTECA) as [keyof typeof CATEGORIAS_BIBLIOTECA, keyof TextosBiblioteca["categorias"]][]).map(
            ([archivo, clave]) => [clave, t.biblioteca[archivo]],
          ),
        ) as unknown as TextosBiblioteca["categorias"],
      },
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
