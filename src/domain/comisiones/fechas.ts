import { exitoComision, falloComision, type ResultadoComision } from "./errores";
import type { SemillaComisiones } from "./semilla";

// Fechas como texto AAAA-MM-DD y aritmética de enteros: no pasan por Date, así
// que ninguna zona horaria puede mover el día.

export interface FechaCivil {
  readonly anio: number;
  readonly mes: number;
  readonly dia: number;
}

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

const esBisiesto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;

export function diasDelMes(anio: number, mes: number): number {
  return [31, esBisiesto(anio) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
}

const dos = (n: number) => String(n).padStart(2, "0");
export const textoDeFecha = (f: FechaCivil) => `${String(f.anio).padStart(4, "0")}-${dos(f.mes)}-${dos(f.dia)}`;

/** "2026-10-07" -> {2026, 10, 7}; error si no es una fecha que exista. */
export function leerFecha(texto: string): ResultadoComision<FechaCivil> {
  const m = RE_FECHA.exec(texto);
  const invalida = () =>
    falloComision<FechaCivil>("FECHA_INVALIDA", `La fecha "${texto}" no es válida. Escríbela como AAAA-MM-DD, por ejemplo 2026-10-07.`);
  if (m === null) return invalida();
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) return invalida();
  return exitoComision({ anio, mes, dia });
}

/** El mes siguiente, con su día fijo (diciembre pasa a enero del año siguiente). */
function enElMesSiguiente(f: FechaCivil, dia: number): FechaCivil {
  return f.mes === 12 ? { anio: f.anio + 1, mes: 1, dia } : { anio: f.anio, mes: f.mes + 1, dia };
}

/** Fecha de pago de lo captado el día `f`, según parametros.pago_comisiones. */
export function pagoDeFecha(pago: SemillaComisiones["pago"], f: FechaCivil): FechaCivil {
  return f.dia <= pago.ultimoDiaQuincena1 ? { ...f, dia: pago.diaPagoQuincena1 } : enElMesSiguiente(f, pago.diaPagoQuincena2);
}

/** Pago de la quincena 2 del mes de `f` (el día fijo del mes siguiente). */
export function pagoDeQuincena2(pago: SemillaComisiones["pago"], f: FechaCivil): FechaCivil {
  return enElMesSiguiente(f, pago.diaPagoQuincena2);
}

/**
 * Del día 1 al último de la quincena 1 se paga el día fijo del mismo mes; del
 * resto del mes, el día fijo del mes siguiente (2026-10-15 -> 2026-10-16;
 * 2026-12-20 -> 2027-01-01).
 */
export function fechaDePagoComision(s: SemillaComisiones, fecha: string): ResultadoComision<string> {
  const f = leerFecha(fecha);
  if (!f.ok) return f;
  return exitoComision(textoDeFecha(pagoDeFecha(s.pago, f.valor)));
}
