import { Decimal } from "../comun/decimal";
import { crearError, type ErrorCotizacion } from "../comun/errores";
import { exito, fallo, type Resultado } from "../comun/resultado";
import { resolverTasa, type SolicitudTasa } from "../tasas/resolver";
import { ESQUEMAS, etiquetasDelEsquema, type Esquema, type Moneda, type Semilla } from "../tasas/semilla.esquema";
import { calcularRendimientos } from "./calcular";
import { calendarioDesdeTasa, type CalendarioModalidad } from "./calendario";
import { cotizar, type Cotizacion } from "./cotizar";

/**
 * Ajustes a la tasa de una cotización, decididos con el dueño (Sprint 3a;
 * límites del Sprint 6a):
 *
 *  - Puntos extra: de 0 a 4.0 en pasos de 0.5, solo en plazos de tabla. Se
 *    suman a la tasa de tabla de AMBAS modalidades: Z = tasa de tabla + puntos/100.
 *  - Plazo especial: meses enteros de 6 a 60, con la tasa anual que el
 *    ejecutivo captura a mano por modalidad (máximo 2 decimales). La tasa NO
 *    sale de la tabla, pero entidad, moneda y monto mínimo se validan con la
 *    tabla, igual que una cotización normal.
 *
 * No duplica fórmulas: las cifras salen de calcularRendimientos y los
 * calendarios de calendarioDesdeTasa.
 *
 * Los topes de abajo son reglas del dueño que aún no están en la semilla
 * (PENDIENTES_TECNICOS.md): pasarlos a los parámetros versionados.
 */
export const PUNTOS_EXTRA = { minimo: new Decimal(0), maximo: new Decimal(4), paso: new Decimal("0.5") } as const;
export const PLAZO_ESPECIAL = { minimo: 6, maximo: 60 } as const;

export type Ajuste =
  | { readonly tipo: "tabla"; readonly puntos: string }
  | {
      readonly tipo: "especial";
      readonly plazo: number;
      /** Tasa anual acordada por modalidad, en PORCENTAJE como texto ("17.00"). Una modalidad sin tasa se omite. */
      readonly tasas: Partial<Record<Esquema, string>>;
    };

/** Cotización con su ajuste: misma forma que Cotizacion, más el desglose de la tasa. */
export interface CotizacionAjustada extends Omit<Cotizacion, "origenTasa" | "tramo"> {
  readonly origenTasa: Cotizacion["origenTasa"] | "especial";
  /** null en un plazo especial: no hay tramo de tabla. */
  readonly tramo: Cotizacion["tramo"] | null;
  /** Tasa de tabla antes de los puntos (fracción); null en un plazo especial. */
  readonly tasaTabla: string | null;
  /** Puntos extra aplicados ("0" en un plazo especial). */
  readonly puntos: string;
}

/** Calendario de una modalidad ajustada: calculado, omitido por no tener tasa acordada, o con error. */
export type ModalidadAjustada =
  | { readonly tipo: "calendario"; readonly calendario: CalendarioModalidad }
  | { readonly tipo: "sin_tasa" }
  | { readonly tipo: "error"; readonly error: ErrorCotizacion };

const RE_PUNTOS = /^[0-9]+(\.[0-9]+)?$/;
const RE_PORCENTAJE = /^[0-9]+(\.[0-9]{1,2})?$/;
const CIEN = new Decimal(100);

/** Puntos como Decimal si están en el conjunto permitido; null si no. */
function leerPuntos(texto: string): Decimal | null {
  if (!RE_PUNTOS.test(texto)) return null;
  const p = new Decimal(texto);
  const enPaso = p.minus(PUNTOS_EXTRA.minimo).div(PUNTOS_EXTRA.paso).isInteger();
  return enPaso && p.gte(PUNTOS_EXTRA.minimo) && p.lte(PUNTOS_EXTRA.maximo) ? p : null;
}

/** Tasa acordada en porcentaje ("17.00") -> fracción; null si no es válida. */
function leerTasaAcordada(texto: string): Decimal | null {
  if (!RE_PORCENTAJE.test(texto)) return null;
  const pct = new Decimal(texto);
  return pct.gt(0) ? pct.div(CIEN) : null;
}

function errorPuntos(texto: string): ErrorCotizacion {
  return crearError(
    "PUNTOS_INVALIDOS",
    `Los puntos extra "${texto}" no son válidos: elige un valor de ${PUNTOS_EXTRA.minimo.toFixed(1)} a ` +
      `${PUNTOS_EXTRA.maximo.toFixed(1)} en pasos de ${PUNTOS_EXTRA.paso.toFixed(1)}.`,
  );
}

/** Las salidas de la cotización con otra tasa, con las mismas fórmulas y etiquetas que cotizar. */
function salidasCon(semilla: Semilla, esquema: Esquema, monto: Decimal, tasa: Decimal, plazo: number): Cotizacion["salidas"] {
  const rendimientos = calcularRendimientos(monto, tasa, plazo);
  const etiquetas = etiquetasDelEsquema(semilla.reglas, esquema);
  return semilla.reglas.salidas.map((clave) => {
    const c = rendimientos[clave];
    return { clave, etiqueta: etiquetas[clave], exacto: c.exacto.toFixed(), redondeado: c.redondeado.toFixed(2), desglose: { ...c.desglose } };
  });
}

function cotizarConPuntos(semilla: Semilla, solicitud: SolicitudTasa, puntosTexto: string): Resultado<CotizacionAjustada> {
  const puntos = leerPuntos(puntosTexto);
  if (puntos === null) return fallo(errorPuntos(puntosTexto));
  const r = cotizar(semilla, solicitud);
  if (!r.ok) return fallo(r.error);
  const c = r.valor;
  const tasa = new Decimal(c.tasa).plus(puntos.div(CIEN));
  const monto = new Decimal(c.solicitud.monto);
  return exito(
    {
      ...c,
      tasa: tasa.toFixed(),
      tasaTabla: c.tasa,
      puntos: puntos.toFixed(),
      salidas: puntos.isZero() ? c.salidas : salidasCon(semilla, c.solicitud.esquema, monto, tasa, c.solicitud.plazo),
    },
    c.avisos,
  );
}

function cotizarEspecial(
  semilla: Semilla,
  solicitud: SolicitudTasa,
  ajuste: Extract<Ajuste, { tipo: "especial" }>,
): Resultado<CotizacionAjustada> {
  // Sonda: resolverTasa revisa tabla de la moneda, entidad, estatus, monto, tramo
  // y, al final, el plazo. Con plazo 0, lo único que puede fallar por el plazo es
  // PLAZO_NO_DISPONIBLE: cualquier otro error es de entidad, moneda o monto.
  const sonda = resolverTasa(semilla, { ...solicitud, plazo: 0 });
  if (!sonda.ok && sonda.error.codigo !== "PLAZO_NO_DISPONIBLE") return fallo(sonda.error);

  const { plazo } = ajuste;
  if (!Number.isInteger(plazo) || plazo < PLAZO_ESPECIAL.minimo || plazo > PLAZO_ESPECIAL.maximo) {
    return fallo(
      crearError(
        "PLAZO_ESPECIAL_INVALIDO",
        `El plazo especial debe ser de ${PLAZO_ESPECIAL.minimo} a ${PLAZO_ESPECIAL.maximo} meses enteros. Corrige el número de meses.`,
      ),
    );
  }
  for (const esquema of ESQUEMAS) {
    const texto = ajuste.tasas[esquema];
    if (texto !== undefined && leerTasaAcordada(texto) === null) {
      return fallo(
        crearError(
          "TASA_INVALIDA",
          `La tasa acordada "${texto}" no es válida: escribe un porcentaje mayor que cero con máximo 2 decimales (por ejemplo 17.50).`,
        ),
      );
    }
  }
  const textoTasa = ajuste.tasas[solicitud.esquema];
  if (textoTasa === undefined) {
    return fallo(crearError("TASA_INVALIDA", "Captura la tasa acordada de la modalidad elegida para cotizar el plazo especial."));
  }

  const tasa = leerTasaAcordada(textoTasa)!;
  const monto = new Decimal(solicitud.monto);
  return exito({
    solicitud: { entidad: solicitud.entidad, moneda: solicitud.moneda, esquema: solicitud.esquema, monto: monto.toFixed(2), plazo },
    tasa: tasa.toFixed(),
    origenTasa: "especial",
    tramo: null,
    tasaTabla: null,
    puntos: "0",
    semilla: { version: semilla.version, generado: semilla.generado },
    salidas: salidasCon(semilla, solicitud.esquema, monto, tasa, plazo),
    avisos: [],
  });
}

/** Cotiza con puntos extra (plazo de tabla) o con un plazo especial y su tasa acordada. */
export function cotizarConAjuste(semilla: Semilla, solicitud: SolicitudTasa, ajuste: Ajuste): Resultado<CotizacionAjustada> {
  return ajuste.tipo === "tabla"
    ? cotizarConPuntos(semilla, solicitud, ajuste.puntos)
    : cotizarEspecial(semilla, { ...solicitud, plazo: ajuste.plazo }, ajuste);
}

/** Las dos modalidades con el mismo ajuste. En un plazo especial, la modalidad sin tasa acordada se omite. */
export function calendariosAjustados(
  semilla: Semilla,
  solicitud: SolicitudTasa,
  ajuste: Ajuste,
): { readonly mensual: ModalidadAjustada; readonly finalDelPlazo: ModalidadAjustada } {
  const modalidad = (esquema: Esquema): ModalidadAjustada => {
    if (ajuste.tipo === "especial" && ajuste.tasas[esquema] === undefined) return { tipo: "sin_tasa" };
    const r = cotizarConAjuste(semilla, { ...solicitud, esquema }, ajuste);
    if (!r.ok) return { tipo: "error", error: r.error };
    const c = r.valor;
    return { tipo: "calendario", calendario: calendarioDesdeTasa(new Decimal(c.solicitud.monto), new Decimal(c.tasa), c.solicitud.plazo, esquema) };
  };
  return { mensual: modalidad("mensual"), finalDelPlazo: modalidad("final_del_plazo") };
}

/** La tasa más alta de la tabla de la moneda (todos los tramos, esquemas y plazos, más el plazo adicional). */
export function tasaMaximaDeTabla(semilla: Semilla, moneda: Moneda): Decimal | null {
  const tabla = semilla.tablas[moneda];
  if (tabla === undefined) return null;
  const tasas = tabla.tramos.flatMap((t) => ESQUEMAS.flatMap((e) => [...t.tasas[e].values()]));
  if (tabla.plazoAdicional !== null) tasas.push(...ESQUEMAS.map((e) => tabla.plazoAdicional!.tasas[e]));
  return tasas.length === 0 ? null : Decimal.max(...tasas);
}
