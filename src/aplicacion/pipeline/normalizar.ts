/**
 * Normalización de los campos del pipeline (funciones puras). Las reglas
 * salen de docs/FORMATOS_EXCEL.md §3: estatus con espacios de más, teléfonos
 * escritos de mil formas y fechas que no existen.
 */

export type Resultado<T> = { readonly ok: true; readonly valor: T } | { readonly ok: false; readonly mensaje: string };

/** Estatus como los guarda la base (enum estatus_prospecto). */
export const ESTATUS = ["INTERESADO", "INTERMITENTE", "NO_INTERESADO"] as const;
export type Estatus = (typeof ESTATUS)[number];

export const MENSAJE_CONTACTO_10_DIGITOS = "El contacto debe tener 10 dígitos.";
const MENSAJE_CONTACTO_VACIO = "Escribe el teléfono de contacto (10 dígitos).";
const MENSAJE_ESTATUS = "El estatus debe ser INTERESADO, INTERMITENTE o NO INTERESADO.";
const MENSAJE_FECHA_FORMATO = "Escribe la fecha de seguimiento como D/M/AAAA (por ejemplo, 15/10/2026) o AAAA-MM-DD.";

const ok = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
const error = <T>(mensaje: string): Resultado<T> => ({ ok: false, mensaje });

/**
 * Quita espacios, guiones, puntos y paréntesis; acepta +52 o 52 al frente y
 * exige exactamente 10 dígitos (0 a 9, no dígitos de otros sistemas).
 */
export function normalizarTelefono(texto: string): Resultado<string> {
  if (texto.trim() === "") return error(MENSAJE_CONTACTO_VACIO);
  let digitos = texto.replace(/[\s\-.()]/g, "");
  if (digitos.startsWith("+52")) digitos = digitos.slice(3);
  else if (/^52[0-9]{10}$/.test(digitos)) digitos = digitos.slice(2);
  return /^[0-9]{10}$/.test(digitos) ? ok(digitos) : error(MENSAJE_CONTACTO_10_DIGITOS);
}

/** "5512345678" -> "55 1234 5678". Lo que no tenga 10 dígitos se queda igual. */
export function telefonoConFormato(contacto: string): string {
  const m = /^([0-9]{2})([0-9]{4})([0-9]{4})$/.exec(contacto);
  return m === null ? contacto : `${m[1]} ${m[2]} ${m[3]}`;
}

/** Recorta, junta espacios y pasa a mayúsculas. "NO INTERESADO" -> NO_INTERESADO. */
export function normalizarEstatus(texto: string): Resultado<Estatus> {
  const limpio = texto.trim().replace(/\s+/g, " ").toUpperCase().replace(" ", "_");
  return (ESTATUS as readonly string[]).includes(limpio) ? ok(limpio as Estatus) : error(MENSAJE_ESTATUS);
}

/** Como se escribe en la pantalla y en el Excel: NO_INTERESADO -> "NO INTERESADO". */
export function estatusEnPantalla(estatus: Estatus): string {
  return estatus.replace("_", " ");
}

const RE_ISO = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;
const RE_DMA = /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/;

/** true si año, mes y día forman una fecha que existe en el calendario. */
export function esFechaReal(anio: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return dia <= ultimo;
}

const dos = (n: number) => String(n).padStart(2, "0");

/**
 * Acepta AAAA-MM-DD y D/M/AAAA (solo fechas reales: 31/02 es error) y
 * devuelve AAAA-MM-DD. Vacía: null (el seguimiento es opcional).
 */
export function normalizarFecha(texto: string): Resultado<string | null> {
  const t = texto.trim();
  if (t === "") return ok(null);
  const iso = RE_ISO.exec(t);
  const dma = RE_DMA.exec(t);
  if (iso === null && dma === null) return error(MENSAJE_FECHA_FORMATO);
  const [anio, mes, dia] = iso !== null ? [iso[1], iso[2], iso[3]].map(Number) : [dma![3], dma![2], dma![1]].map(Number);
  if (!esFechaReal(anio, mes, dia)) return error(`La fecha de seguimiento ${t} no existe. Revisa el día y el mes.`);
  return ok(`${String(anio).padStart(4, "0")}-${dos(mes)}-${dos(dia)}`);
}
