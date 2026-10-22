import { esHostPermitido } from "../aplicacion/host";
import { hostsPermitidos } from "./supabase/config";

/**
 * Guardia de Host: la app solo atiende peticiones cuyo encabezado Host esté
 * permitido. Sin HOSTS_PERMITIDOS, solo localhost, 127.0.0.1 o [::1] (con
 * cualquier puerto); con ella, solo los hosts exactos de la lista, que
 * REEMPLAZA a los locales.
 *
 * NO es seguridad real: el encabezado Host lo manda el cliente. Es un seguro
 * contra un despliegue accidental o bajo una dirección no prevista. Con una
 * lista mal formada falla cerrado (rechaza todo); next.config.ts además la
 * valida al arrancar.
 *
 * No importa server-only: también lo usa src/proxy.ts, que no corre como
 * componente de servidor de React.
 */
export const MENSAJE_HOST_NO_AUTORIZADO = "Esta dirección no está autorizada para esta aplicación.";

/** true si el Host está permitido; false también si HOSTS_PERMITIDOS está mal formada. */
export function hostAutorizado(host: string | null | undefined): boolean {
  try {
    return esHostPermitido(host, hostsPermitidos());
  } catch {
    return false;
  }
}

/** Respuesta 403 si el Host no está permitido; null si la petición puede seguir. */
export function rechazoPorHost(host: string | null): Response | null {
  if (hostAutorizado(host)) return null;
  return new Response(MENSAJE_HOST_NO_AUTORIZADO, {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
