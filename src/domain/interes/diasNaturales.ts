import { Decimal } from "../comun/decimal";
import { crearError } from "../comun/errores";
import { formatearCantidad } from "../comun/formato";
import { exito, fallo, type Resultado } from "../comun/resultado";
import type { SolicitudTasa } from "../tasas/resolver";
import type { Esquema, Semilla } from "../tasas/semilla.esquema";
import { cotizarConAjuste, type Ajuste, type ModalidadAjustada } from "./ajustes";
import type { Cifra, Rendimientos } from "./calcular";
import { aCentavos } from "./redondeo";

// Rendimientos a días naturales y fechas de pago (Sprint 6b). Las funciones de
// meses ÷ 12 (calcular.ts y calendario.ts) siguen igual; el PDF y la pantalla
// usan estas.
//
// Las fechas son texto AAAA-MM-DD y se cuentan como días civiles en UTC: la
// zona horaria no puede mover un día.

/** Base de los días naturales: días reales ÷ 365, siempre 365, también en año bisiesto. */
const DIAS_POR_ANIO = 365;

/** Meses del año: solo para el rendimiento mensual promedio y el anual (no es un parámetro de negocio). */
const MESES_POR_ANIO = 12;

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Dia {
  readonly anio: number;
  readonly mes: number;
  readonly dia: number;
}

const bisiesto = (anio: number) => (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;

function diasDelMes(anio: number, mes: number): number {
  return [31, bisiesto(anio) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
}

/** La fecha si es AAAA-MM-DD y existe en el calendario; null si no. */
function leerFecha(texto: string): Dia | null {
  const m = RE_FECHA.exec(texto);
  if (m === null) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) return null;
  return { anio, mes, dia };
}

function fechaValida(texto: string): Dia {
  const d = leerFecha(texto);
  if (d === null) throw new Error(`La fecha "${texto}" no es válida: debe existir y tener el formato AAAA-MM-DD.`);
  return d;
}

const dosCifras = (n: number) => String(n).padStart(2, "0");
const comoTexto = (d: Dia) => `${String(d.anio).padStart(4, "0")}-${dosCifras(d.mes)}-${dosCifras(d.dia)}`;
const comoDdMmAaaa = (d: Dia) => `${dosCifras(d.dia)}/${dosCifras(d.mes)}/${d.anio}`;

const MS_POR_DIA = 86_400_000;

/** Número de día desde 1970-01-01 (Date.UTC: sin zona horaria, el día no se mueve). */
const numeroDeDia = ({ anio, mes, dia }: Dia) => Date.UTC(anio, mes - 1, dia) / MS_POR_DIA;

/** El día de un número de día (inversa de numeroDeDia). */
function diaDeNumero(n: number): Dia {
  const f = new Date(n * MS_POR_DIA);
  return { anio: f.getUTCFullYear(), mes: f.getUTCMonth() + 1, dia: f.getUTCDate() };
}

/**
 * Fecha del pago k: el mismo día del mes, k meses después del inicio. Si ese
 * día no existe en el mes, el último día del mes; los pagos siguientes vuelven
 * al día original (se cuenta siempre desde el inicio, no desde el pago anterior).
 */
export function fechaDePago(inicio: string, k: number): string {
  const d = fechaValida(inicio);
  const meses = d.mes - 1 + k;
  const anio = d.anio + Math.floor(meses / 12);
  const mes = (meses % 12) + 1;
  return comoTexto({ anio, mes, dia: Math.min(d.dia, diasDelMes(anio, mes)) });
}

/** Días reales de `desde` a `hasta` (hasta − desde). */
export function diasEntre(desde: string, hasta: string): number {
  return numeroDeDia(fechaValida(hasta)) - numeroDeDia(fechaValida(desde));
}

/** Rendimiento de `dias` días a centavos: monto × tasa × días ÷ 365. */
const porDias = (monto: Decimal, tasa: Decimal, dias: number) => aCentavos(monto.times(tasa).times(dias).div(DIAS_POR_ANIO));

/** Un periodo del calendario. Cifras como texto decimal con 2 decimales. */
export interface FilaPorFechas {
  /** 1 a plazo. */
  readonly numero: number;
  /** Fecha de pago, AAAA-MM-DD. */
  readonly fecha: string;
  /** Días del periodo: fecha k menos fecha k−1. */
  readonly dias: number;
  /** Pago del periodo (modalidad mensual). */
  readonly rendimiento: string;
  /** Suma corrida de los pagos. */
  readonly acumulado: string;
  /** monto × tasa × días transcurridos desde el inicio ÷ 365 (lo que lleva devengado al final del plazo). */
  readonly devengado: string;
}

/** Calendario de una modalidad por fechas, con las cifras de su tarjeta. */
export interface CalendarioPorFechas {
  readonly esquema: Esquema;
  /** Tasa anual, como texto decimal. */
  readonly tasa: string;
  readonly capitalInicial: string;
  /** AAAA-MM-DD. El rendimiento corre desde el día siguiente. */
  readonly fechaInicio: string;
  /** Fecha del último pago, AAAA-MM-DD. */
  readonly vencimiento: string;
  readonly diasTotales: number;
  /** monto × tasa × días totales ÷ 365 a centavos. */
  readonly rendimientoTotal: string;
  /** Capital + rendimiento total. */
  readonly total: string;
  readonly filas: readonly FilaPorFechas[];
}

/**
 * El calendario de una modalidad con una tasa anual ya decidida. Solo
 * aritmética: no valida nada (la fecha de inicio debe venir ya validada).
 *   pago k = monto × tasa × días del periodo k ÷ 365 a centavos;
 *   el último pago = rendimiento total − la suma de los anteriores.
 */
export function calendarioPorFechas(monto: Decimal, tasa: Decimal, plazo: number, esquema: Esquema, inicio: string): CalendarioPorFechas {
  const fechas = [inicio, ...Array.from({ length: plazo }, (_, i) => fechaDePago(inicio, i + 1))];
  const diasTotales = diasEntre(inicio, fechas[plazo]);
  const rendimientoTotal = porDias(monto, tasa, diasTotales);

  let acumulado = new Decimal(0);
  const filas = Array.from({ length: plazo }, (_, i): FilaPorFechas => {
    const dias = diasEntre(fechas[i], fechas[i + 1]);
    const pago = i === plazo - 1 ? rendimientoTotal.minus(acumulado) : porDias(monto, tasa, dias);
    acumulado = acumulado.plus(pago);
    return {
      numero: i + 1,
      fecha: fechas[i + 1],
      dias,
      rendimiento: pago.toFixed(2),
      acumulado: acumulado.toFixed(2),
      devengado: porDias(monto, tasa, diasEntre(inicio, fechas[i + 1])).toFixed(2),
    };
  });

  return {
    esquema,
    tasa: tasa.toFixed(),
    capitalInicial: monto.toFixed(2),
    fechaInicio: inicio,
    vencimiento: fechas[plazo],
    diasTotales,
    rendimientoTotal: rendimientoTotal.toFixed(2),
    total: monto.plus(rendimientoTotal).toFixed(2),
    filas,
  };
}

function cifra(exacto: Decimal, formula: string, factores: readonly string[], divisor: number | null): Cifra {
  const redondeado = aCentavos(exacto);
  const operacion = factores.join(" × ") + (divisor === null ? "" : ` ÷ ${divisor}`) + ` = ${formatearCantidad(redondeado)}`;
  return { exacto, redondeado, desglose: { formula, operacion } };
}

/**
 * Las cifras de la página 1 con su desglose ("Cómo se calculó"):
 *   mensual (promedio) = monto × tasa ÷ 12
 *   anual (12 meses)   = monto × tasa
 *   total del plazo    = monto × tasa × días totales ÷ 365
 */
export function rendimientosPorFechas(monto: Decimal, tasa: Decimal, plazo: number, inicio: string): Rendimientos {
  const montoPorTasa = monto.times(tasa);
  const dias = diasEntre(inicio, fechaDePago(inicio, plazo));
  const m = formatearCantidad(monto);
  const t = tasa.toString();
  return {
    rendimiento_mensual_pesos: cifra(montoPorTasa.div(MESES_POR_ANIO), `monto × tasa anual neta ÷ ${MESES_POR_ANIO}`, [m, t], MESES_POR_ANIO),
    rendimiento_anual_pesos: cifra(montoPorTasa, "monto × tasa anual neta", [m, t], null),
    ganancia_total_plazo: cifra(
      montoPorTasa.times(dias).div(DIAS_POR_ANIO),
      `monto × tasa anual neta × días ÷ ${DIAS_POR_ANIO}`,
      [m, t, String(dias)],
      DIAS_POR_ANIO,
    ),
  };
}

/** Rango permitido de la fecha de inicio, en días respecto de hoy (sale de la semilla). */
export interface RangoFechaInicio {
  readonly diasAtras: number;
  readonly diasAdelante: number;
}

/**
 * Valida la fecha de inicio (AAAA-MM-DD) contra hoy (AAAA-MM-DD, en la Ciudad
 * de México): de `diasAtras` días antes a `diasAdelante` días después.
 */
export function validarFechaInicio(texto: string, hoy: string, rango: RangoFechaInicio): Resultado<string> {
  const nHoy = numeroDeDia(fechaValida(hoy));
  const desde = comoDdMmAaaa(diaDeNumero(nHoy - rango.diasAtras));
  const hasta = comoDdMmAaaa(diaDeNumero(nHoy + rango.diasAdelante));
  const d = leerFecha(texto);
  if (d === null) {
    return fallo(crearError("FECHA_INICIO_INVALIDA", `La fecha de inicio no es válida. Elige una fecha del ${desde} al ${hasta}.`));
  }
  const n = numeroDeDia(d);
  if (n < nHoy - rango.diasAtras || n > nHoy + rango.diasAdelante) {
    return fallo(
      crearError(
        "FECHA_INICIO_INVALIDA",
        `La fecha de inicio ${comoDdMmAaaa(d)} está fuera del rango permitido. Elige una fecha del ${desde} al ${hasta}.`,
      ),
    );
  }
  return exito(comoTexto(d));
}

/** Calendario por fechas de una modalidad ajustada: calculado, omitido por no tener tasa acordada, o con error. */
export type ModalidadPorFechas =
  | { readonly tipo: "calendario"; readonly calendario: CalendarioPorFechas }
  | Exclude<ModalidadAjustada, { tipo: "calendario" }>;

/**
 * Las dos modalidades por fechas con el mismo ajuste (puntos extra o plazo
 * especial). La tasa sale de cotizarConAjuste; en un plazo especial, la
 * modalidad sin tasa acordada se omite.
 */
export function calendariosPorFechas(
  semilla: Semilla,
  solicitud: SolicitudTasa,
  ajuste: Ajuste,
  inicio: string,
): { readonly mensual: ModalidadPorFechas; readonly finalDelPlazo: ModalidadPorFechas } {
  const modalidad = (esquema: Esquema): ModalidadPorFechas => {
    if (ajuste.tipo === "especial" && ajuste.tasas[esquema] === undefined) return { tipo: "sin_tasa" };
    const r = cotizarConAjuste(semilla, { ...solicitud, esquema }, ajuste);
    if (!r.ok) return { tipo: "error", error: r.error };
    const c = r.valor;
    return {
      tipo: "calendario",
      calendario: calendarioPorFechas(new Decimal(c.solicitud.monto), new Decimal(c.tasa), c.solicitud.plazo, esquema, inicio),
    };
  };
  return { mensual: modalidad("mensual"), finalDelPlazo: modalidad("final_del_plazo") };
}
