/** La app se usa en la Ciudad de México: el saludo y la fecha siguen su hora, no la del servidor. */
const ZONA = "America/Mexico_City";

/** Hora (0 a 23) en la Ciudad de México. */
export function horaEnMexico(ahora: Date): number {
  const texto = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA, hour: "numeric", hourCycle: "h23" }).format(ahora);
  return Number.parseInt(texto, 10);
}

/** Buenos días de 6:00 a 11:59, buenas tardes de 12:00 a 18:59 y buenas noches el resto. */
export function saludoPara(hora: number): string {
  if (hora >= 6 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** "Viernes 2 de octubre de 2026". */
export function fechaDeHoy(ahora: Date): string {
  const texto = new Intl.DateTimeFormat("es-MX", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(ahora)
    .replace(",", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
