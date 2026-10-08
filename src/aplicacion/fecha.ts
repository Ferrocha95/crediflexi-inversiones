/** Zona horaria de las fechas que se imprimen (no es un parámetro de negocio). */
const ZONA_MEXICO = "America/Mexico_City";

const RE_FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * "2026-10-01" -> "01/10/2026". Corta el texto sin pasar por Date, para que la
 * zona horaria no pueda mover el día.
 */
export function fechaDeTextoIso(texto: string): string {
  const m = RE_FECHA_ISO.exec(texto);
  if (m === null) throw new Error(`La fecha "${texto}" no tiene el formato AAAA-MM-DD.`);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const formatoMexico = new Intl.DateTimeFormat("es-MX", {
  timeZone: ZONA_MEXICO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Fecha del instante en la Ciudad de México, en DD/MM/AAAA. */
export function fechaEnMexico(instante: Date): string {
  const partes = Object.fromEntries(formatoMexico.formatToParts(instante).map((p) => [p.type, p.value]));
  return `${partes.day}/${partes.month}/${partes.year}`;
}

/** Fecha del instante en la Ciudad de México, en AAAA-MM-DD (para nombres de archivo). */
export function fechaIsoEnMexico(instante: Date): string {
  const partes = Object.fromEntries(formatoMexico.formatToParts(instante).map((p) => [p.type, p.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

const formatoFechaLarga = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const formatoMes = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", month: "long" });

/** Valida AAAA-MM-DD y lo convierte en un Date a medianoche UTC (solo para formatear: el día no se mueve). */
function diaUtc(texto: string): Date {
  if (!RE_FECHA_ISO.test(texto)) throw new Error(`La fecha "${texto}" no tiene el formato AAAA-MM-DD.`);
  return new Date(`${texto}T00:00:00Z`);
}

/** "2026-10-07" -> "7 de octubre de 2026". */
export function fechaLarga(texto: string): string {
  return formatoFechaLarga.format(diaUtc(texto));
}

/** "2026-10-07" -> "octubre". */
export function nombreDeMes(texto: string): string {
  return formatoMes.format(diaUtc(texto));
}
