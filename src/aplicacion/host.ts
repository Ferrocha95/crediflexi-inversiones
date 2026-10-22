const RE_HOST_LOCAL = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::(\d{1,5}))?$/i;

/** Una etiqueta de dominio: letras, dígitos y guiones, sin guion al inicio ni al final. */
const ETIQUETA = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
/** Una entrada de HOSTS_PERMITIDOS: nombre o IPv4 con puntos, o IPv6 entre corchetes; puerto opcional. */
const RE_ENTRADA = new RegExp(`^(?:${ETIQUETA}(?:\\.${ETIQUETA})*|\\[[0-9a-f:.]+\\])(?::(\\d{1,5}))?$`);

const puertoValido = (puerto: string | undefined) => puerto === undefined || (Number(puerto) >= 1 && Number(puerto) <= 65535);

/**
 * true si el encabezado Host apunta a esta misma máquina: localhost, 127.0.0.1
 * o [::1], con o sin puerto (1 a 65535). Es la lista por omisión, cuando no
 * está definida HOSTS_PERMITIDOS.
 */
export function esHostLocal(host: string | null | undefined): boolean {
  if (host === null || host === undefined) return false;
  const m = RE_HOST_LOCAL.exec(host);
  return m !== null && puertoValido(m[1]);
}

/**
 * Lee HOSTS_PERMITIDOS: hosts exactos separados por comas, con puerto si lo
 * lleva. Sin la variable (undefined) devuelve null, que significa "solo los
 * locales". Cada entrada se recorta y pasa a minúsculas. Una lista mal
 * formada (vacía, comodines, @, rutas, esquema, espacios internos o puerto
 * fuera de 1 a 65535) lanza un error en español que dice qué entrada falló
 * por su número, sin repetir el valor, para no abrir la app por accidente.
 */
export function leerHostsPermitidos(valor: string | undefined): readonly string[] | null {
  if (valor === undefined) return null;
  const entradas = valor.split(",").map((e) => e.trim().toLowerCase());
  entradas.forEach((entrada, i) => {
    const m = RE_ENTRADA.exec(entrada);
    if (m === null || !puertoValido(m[1])) {
      throw new Error(
        `HOSTS_PERMITIDOS está mal formada: la entrada ${i + 1} no es un host exacto. ` +
          "Usa hosts separados por comas, con puerto si lo lleva (por ejemplo, mi-app.vercel.app), " +
          "sin comodines, @, rutas, https:// ni espacios. Corrígela en las variables de entorno y vuelve a arrancar.",
      );
    }
  });
  return entradas;
}

/**
 * true si el Host está permitido: con lista null, solo los locales
 * (esHostLocal); con lista, solo los hosts de la lista, comparados exactos y
 * sin distinguir mayúsculas. La lista REEMPLAZA a los locales.
 *
 * NO es seguridad por sí sola: el cliente puede mandar el Host que quiera. Es
 * un seguro contra un despliegue accidental o bajo una dirección no prevista.
 */
export function esHostPermitido(host: string | null | undefined, lista: readonly string[] | null): boolean {
  if (host === null || host === undefined) return false;
  if (lista === null) return esHostLocal(host);
  return lista.includes(host.toLowerCase());
}
