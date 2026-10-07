import { fechaIsoEnMexico } from "../fecha";

/**
 * Semana del pipeline: de lunes a viernes, en America/Mexico_City. El sábado y
 * el domingo pertenecen a la semana que acaba de terminar (el Excel del
 * viernes reporta esa semana). Funciones puras sobre fechas AAAA-MM-DD: se
 * calcula en UTC para que la zona horaria de la máquina no mueva el día.
 */

export interface Semana {
  /** AAAA-MM-DD */
  readonly lunes: string;
  /** AAAA-MM-DD */
  readonly viernes: string;
}

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

const aUtc = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const aIso = (f: Date) => f.toISOString().slice(0, 10);

/** Suma (o resta) días a una fecha AAAA-MM-DD. */
export function sumarDias(iso: string, dias: number): string {
  const f = aUtc(iso);
  f.setUTCDate(f.getUTCDate() + dias);
  return aIso(f);
}

/** Semana de un día: de lunes a viernes; sábado y domingo, la que acaba de terminar. */
export function semanaDe(iso: string): Semana {
  const diaSemana = aUtc(iso).getUTCDay(); // 0 domingo … 6 sábado
  const desdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;
  const lunes = sumarDias(iso, -desdeLunes);
  return { lunes, viernes: sumarDias(lunes, 4) };
}

/** Semana de hoy en la Ciudad de México. */
export function semanaActual(ahora: Date): Semana {
  return semanaDe(fechaIsoEnMexico(ahora));
}

/** La semana dada y las n − 1 anteriores, de la más reciente a la más antigua. */
export function semanasRecientes(actual: Semana, n: number): Semana[] {
  return Array.from({ length: n }, (_, i) => semanaDe(sumarDias(actual.lunes, -7 * i)));
}

const partes = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return { anio: a, mes: MESES[m - 1], dia: d };
};

/**
 * Rango del encabezado del Excel: "28 DE SEPTIEMBRE A 2 DE OCTUBRE 2026".
 * Siempre nombra los dos meses; si cruza de año, nombra los dos años:
 * "29 DE DICIEMBRE 2025 A 2 DE ENERO 2026".
 */
export function rangoSemanaEnTexto(semana: Semana): string {
  const l = partes(semana.lunes);
  const v = partes(semana.viernes);
  const anioLunes = l.anio === v.anio ? "" : ` ${l.anio}`;
  return `${l.dia} DE ${l.mes}${anioLunes} A ${v.dia} DE ${v.mes} ${v.anio}`;
}

/** Mes del viernes, en mayúsculas: el del nombre del archivo PIPELINE_{MES}.xlsx. */
export function mesDelViernes(semana: Semana): string {
  return partes(semana.viernes).mes;
}
