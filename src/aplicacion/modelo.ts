import { Decimal } from "../domain/comun/decimal";
import { formatearMonto, formatearPesos, formatearPorcentaje } from "../domain/comun/formato";
import type { CodigoAviso } from "../domain/comun/resultado";
import type { Cotizacion } from "../domain/interes/cotizar";
import type { Esquema, Estatus, Moneda, Salida } from "../domain/tasas/semilla.esquema";
import { limpiarCampo } from "./campos";
import { fechaDeTextoIso, fechaEnMexico } from "./fecha";
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

const pesos = (texto: string) => formatearPesos(new Decimal(texto));
const monto = (texto: string, moneda: Moneda) => formatearMonto(new Decimal(texto), moneda);
const meses = (plazo: number) => `${plazo} ${plazo === 1 ? "mes" : "meses"}`;

function rangoDelTramo(tramo: Cotizacion["tramo"], moneda: Moneda): string {
  const desde = `Desde ${monto(tramo.desde, moneda)}`;
  return tramo.hasta === null ? desde : `${desde} hasta ${monto(tramo.hasta, moneda)}`;
}

function tasasDeLaCotizacion(c: Cotizacion) {
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
  readonly origenTasa: Cotizacion["origenTasa"];
  /** Tramo aplicado con su estatus visible (pendiente t). */
  readonly tramo: {
    readonly rango: string;
    readonly estatus: Estatus | null;
    readonly explicacionEstatus: string | null;
  };
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

export function modeloVistaPrevia(c: Cotizacion, textos: TextosCotizacion): ModeloVistaPrevia {
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
    tramo: {
      rango: rangoDelTramo(c.tramo, moneda),
      estatus: c.tramo.estatus,
      explicacionEstatus: c.tramo.estatus === null ? null : textos.estatusTramo[c.tramo.estatus],
    },
    salidas: c.salidas.map((s) => ({
      clave: s.clave,
      etiqueta: s.etiqueta,
      cifra: pesos(s.redondeado),
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
}

const oNulo = (texto: string) => (texto === "" ? null : texto);

/**
 * Arma el modelo del PDF a partir de una cotización ya hecha. `ahora` entra
 * como parámetro para que la función sea pura.
 */
export function modeloPdf(
  c: Cotizacion,
  contexto: ContextoPdf,
  entrada: EntradaPdf,
  ahora: Date,
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
    cifra: pesos(s.redondeado),
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
  });
}
