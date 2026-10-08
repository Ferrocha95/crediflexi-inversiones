import { Decimal } from "../domain/comun/decimal";
import { formatearMonto, formatearPorcentaje } from "../domain/comun/formato";
import type { CodigoAviso } from "../domain/comun/resultado";
import type { CotizacionAjustada } from "../domain/interes/ajustes";
import type { Cotizacion } from "../domain/interes/cotizar";
import type { AvisoTasaAcordada } from "./ajustes";
import type { Esquema, Estatus, Moneda, Salida } from "../domain/tasas/semilla.esquema";
import { limpiarCampo } from "./campos";
import { formatearDinero } from "./dinero";
import { fechaDeTextoIso, fechaEnMexico } from "./fecha";
import { modeloPagina2, type DatosPagina2, type ModeloPagina2 } from "./pagina2";
import { rellenar } from "./rellenar";
import { error, ok, type ResultadoApp } from "./resultado";
import type { TextosCotizacion, TextosPdf } from "./textos";

// Este módulo no calcula: solo da forma de texto a lo que ya devolvió cotizar.

/** Topes de caracteres de los campos que se escriben a mano en la pantalla. */
export const TOPES = {
  preparadoPara: 120,
  ejecutivo: 120,
  vigencia: 60,
  notaAdicional: 300,
} as const;

const dinero = (texto: string, moneda: Moneda) => formatearDinero(new Decimal(texto), moneda);
const monto = (texto: string, moneda: Moneda) => formatearMonto(new Decimal(texto), moneda);
const meses = (plazo: number) => `${plazo} ${plazo === 1 ? "mes" : "meses"}`;

/** Una cotización de tabla tal cual, o con puntos extra o plazo especial (cotizarConAjuste). */
export type CotizacionParaModelo = Cotizacion | CotizacionAjustada;

const esAjustada = (c: CotizacionParaModelo): c is CotizacionAjustada => "puntos" in c;

/** Desglose "tasa de tabla + puntos = tasa" cuando hay puntos extra; null si no hay. */
function desgloseDeTasa(c: CotizacionParaModelo): ModeloVistaPrevia["desgloseTasa"] {
  if (!esAjustada(c) || c.tasaTabla === null || new Decimal(c.puntos).isZero()) return null;
  return {
    tasaTabla: formatearPorcentaje(new Decimal(c.tasaTabla)),
    puntos: new Decimal(c.puntos).toFixed(1),
    tasa: formatearPorcentaje(new Decimal(c.tasa)),
  };
}

function rangoDelTramo(tramo: Cotizacion["tramo"], moneda: Moneda): string {
  const desde = `Desde ${monto(tramo.desde, moneda)}`;
  return tramo.hasta === null ? desde : `${desde} hasta ${monto(tramo.hasta, moneda)}`;
}

function tasasDeLaCotizacion(c: CotizacionParaModelo) {
  return { version: c.semilla.version, fecha: fechaDeTextoIso(c.semilla.generado) };
}

// ---------------------------------------------------------------------------
// Vista previa (pantalla)
// ---------------------------------------------------------------------------

export interface ModeloVistaPrevia {
  readonly solicitud: {
    readonly entidad: string;
    readonly moneda: Moneda;
    readonly esquema: string;
    readonly monto: string;
    readonly plazo: string;
  };
  readonly tasa: string;
  readonly origenTasa: CotizacionAjustada["origenTasa"];
  /** Tramo aplicado con su estatus visible (pendiente t); null en un plazo especial (no hay tabla). */
  readonly tramo: {
    readonly rango: string;
    readonly estatus: Estatus | null;
    readonly explicacionEstatus: string | null;
  } | null;
  /** "Tasa de tabla X% + Y puntos extra = Z%": solo con puntos extra. */
  readonly desgloseTasa: { readonly tasaTabla: string; readonly puntos: string; readonly tasa: string } | null;
  /** true si es un plazo especial con tasa acordada. */
  readonly plazoEspecial: boolean;
  /** Aviso no bloqueante: la tasa acordada pasa de la máxima de la tabla más 5 puntos. */
  readonly tasaAcordadaAlta: AvisoTasaAcordada | null;
  readonly salidas: readonly {
    readonly clave: Salida;
    readonly etiqueta: string;
    readonly cifra: string;
    readonly formula: string;
    readonly operacion: string;
  }[];
  /** Avisos no bloqueantes, con el mensaje del dominio tal cual. */
  readonly avisos: readonly { readonly codigo: CodigoAviso; readonly mensaje: string }[];
  readonly tasas: { readonly version: string; readonly fecha: string };
}

export function modeloVistaPrevia(
  c: CotizacionParaModelo,
  textos: TextosCotizacion,
  extras: { readonly tasaAcordadaAlta?: AvisoTasaAcordada | null } = {},
): ModeloVistaPrevia {
  const { moneda } = c.solicitud;
  return {
    solicitud: {
      entidad: c.solicitud.entidad,
      moneda,
      esquema: textos.nombreEsquema[c.solicitud.esquema],
      monto: monto(c.solicitud.monto, moneda),
      plazo: meses(c.solicitud.plazo),
    },
    tasa: formatearPorcentaje(new Decimal(c.tasa)),
    origenTasa: c.origenTasa,
    tramo:
      c.tramo === null
        ? null
        : {
            rango: rangoDelTramo(c.tramo, moneda),
            estatus: c.tramo.estatus,
            explicacionEstatus: c.tramo.estatus === null ? null : textos.estatusTramo[c.tramo.estatus],
          },
    desgloseTasa: desgloseDeTasa(c),
    plazoEspecial: c.origenTasa === "especial",
    tasaAcordadaAlta: extras.tasaAcordadaAlta ?? null,
    salidas: c.salidas.map((s) => ({
      clave: s.clave,
      etiqueta: s.etiqueta,
      cifra: dinero(s.redondeado, moneda),
      formula: s.desglose.formula,
      operacion: s.desglose.operacion,
    })),
    avisos: c.avisos.map((a) => ({ codigo: a.codigo, mensaje: a.mensaje })),
    tasas: tasasDeLaCotizacion(c),
  };
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/** Lo que se escribe a mano en la pantalla. Nada de esto se guarda ni se registra. */
export interface EntradaPdf {
  readonly preparadoPara?: string;
  /** Nombre y contacto del ejecutivo, en una línea. */
  readonly ejecutivo?: string;
  readonly vigencia?: string;
  readonly notaAdicional?: string;
}

export interface ContextoPdf {
  /** Clave de la entidad -> razón social completa. */
  readonly razonesSociales: ReadonlyMap<string, string>;
  readonly textos: TextosCotizacion;
}

/** La cifra que el PDF destaca en grande, según el esquema. */
export const CIFRA_PRINCIPAL: Readonly<Record<Esquema, Salida>> = {
  mensual: "rendimiento_mensual_pesos",
  final_del_plazo: "ganancia_total_plazo",
};

export interface CifraPdf {
  readonly clave: Salida;
  readonly etiqueta: string;
  readonly cifra: string;
  readonly formula: string;
  readonly operacion: string;
}

/**
 * Lo que imprime el PDF. A propósito no trae el estatus del tramo, ni su
 * explicación, ni los avisos: eso solo se muestra en la pantalla.
 */
export interface ModeloPdf {
  readonly fecha: string;
  readonly encabezado: { readonly razonSocial: string };
  readonly solicitud: {
    readonly moneda: Moneda;
    readonly esquema: string;
    readonly monto: string;
    readonly plazo: string;
  };
  readonly tasa: string;
  /** Textos fijos del documento, tal como vienen del archivo (sin la plantilla de la línea de tasas). */
  readonly textos: Omit<TextosPdf, "lineaTasas">;
  /** La cifra destacada (CIFRA_PRINCIPAL), con su etiqueta de la semilla. */
  readonly cifraPrincipal: { readonly clave: Salida; readonly etiqueta: string; readonly cifra: string };
  /** Todas las cifras, en el orden de la semilla, con su desglose. */
  readonly cifras: readonly CifraPdf[];
  readonly tasas: { readonly version: string; readonly fecha: string };
  /** pdf.linea_tasas ya rellenada. */
  readonly lineaTasas: string;
  readonly preparadoPara: string | null;
  readonly pie: {
    readonly base: string;
    readonly preparadoPor: string | null;
    readonly vigencia: string | null;
    readonly notaAdicional: string | null;
  };
  /** Página 2: calendario de las dos modalidades, comparación y escenario de reinversión. */
  readonly pagina2: ModeloPagina2;
}

const oNulo = (texto: string) => (texto === "" ? null : texto);

/**
 * Arma el modelo del PDF a partir de una cotización ya hecha y de los datos de
 * la página 2 (datosPagina2, con la misma semilla). `ahora` entra como
 * parámetro para que la función sea pura.
 */
export function modeloPdf(
  c: CotizacionParaModelo,
  contexto: ContextoPdf,
  entrada: EntradaPdf,
  ahora: Date,
  datos: DatosPagina2,
): ResultadoApp<ModeloPdf> {
  const { entidad, moneda } = c.solicitud;
  const razonSocial = contexto.razonesSociales.get(entidad);
  if (razonSocial === undefined) {
    return error(
      "ENTIDADES_INVALIDAS",
      `La entidad ${entidad} no tiene razón social en la semilla. ` +
        "Agrégala en entidades[].razon_social de los parámetros.",
    );
  }

  const preparadoPara = limpiarCampo(entrada.preparadoPara ?? "", TOPES.preparadoPara);
  const ejecutivo = limpiarCampo(entrada.ejecutivo ?? "", TOPES.ejecutivo);
  const vigencia = limpiarCampo(entrada.vigencia ?? "", TOPES.vigencia);
  const notaAdicional = limpiarCampo(entrada.notaAdicional ?? "", TOPES.notaAdicional);

  const tasas = tasasDeLaCotizacion(c);
  const { textos } = contexto;
  const { lineaTasas, ...textosPdf } = textos.pdf;

  const cifras: CifraPdf[] = c.salidas.map((s) => ({
    clave: s.clave,
    etiqueta: s.etiqueta,
    cifra: dinero(s.redondeado, c.solicitud.moneda),
    formula: s.desglose.formula,
    operacion: s.desglose.operacion,
  }));
  const principal = cifras.find((x) => x.clave === CIFRA_PRINCIPAL[c.solicitud.esquema]);
  if (principal === undefined) {
    return error(
      "SEMILLA_INVALIDA",
      `El PDF destaca la salida ${CIFRA_PRINCIPAL[c.solicitud.esquema]}, pero no está en ` +
        "reglas_de_calculo.salidas_de_cotizacion de la semilla. Agrégala y vuelve a intentarlo.",
    );
  }

  // Cada plantilla recibe solo los marcadores que su campo permite (MARCADORES_POR_CAMPO).
  return ok({
    fecha: fechaEnMexico(ahora),
    encabezado: { razonSocial },
    solicitud: {
      moneda,
      esquema: textos.nombreEsquema[c.solicitud.esquema],
      monto: monto(c.solicitud.monto, moneda),
      plazo: meses(c.solicitud.plazo),
    },
    tasa: formatearPorcentaje(new Decimal(c.tasa)),
    textos: textosPdf,
    cifraPrincipal: { clave: principal.clave, etiqueta: principal.etiqueta, cifra: principal.cifra },
    cifras,
    tasas,
    lineaTasas: rellenar(lineaTasas, { version_tasas: tasas.version, fecha_tasas: tasas.fecha }),
    preparadoPara: oNulo(preparadoPara),
    pie: {
      base: rellenar(textos.pieBase, {
        razon_social: razonSocial,
        version_tasas: tasas.version,
        fecha_tasas: tasas.fecha,
      }),
      preparadoPor: ejecutivo === "" ? null : rellenar(textos.lineaPreparadoPor, { ejecutivo }),
      vigencia: vigencia === "" ? null : rellenar(textos.lineaVigencia, { vigencia }),
      notaAdicional: oNulo(notaAdicional),
    },
    pagina2: modeloPagina2(c, datos, textos.pdfPagina2),
  });
}
