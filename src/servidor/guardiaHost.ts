import { esHostLocal } from "../aplicacion/host";

/**
 * Seguro contra un despliegue accidental: esta versión es solo local (sin
 * login y sin base de datos), así que solo atiende peticiones cuyo encabezado
 * Host sea localhost, 127.0.0.1 o [::1].
 *
 * NO es seguridad real. El encabezado Host lo manda el cliente y cualquiera
 * puede falsearlo. Solo evita que la app conteste si alguien la sube a un
 * servidor por error.
 *
 * No importa server-only: también lo usa src/proxy.ts, que no corre como
 * componente de servidor de React.
 */
export const MENSAJE_HOST_NO_LOCAL =
  "Esta versión del cotizador solo funciona en la computadora donde se ejecuta: ábrela con la dirección localhost " +
  "desde ese mismo equipo. Si ves este mensaje en un servidor, la app se desplegó por accidente y hay que detenerla.";

/** Respuesta 403 si el Host no es local; null si la petición puede seguir. */
export function rechazoPorHost(host: string | null): Response | null {
  if (esHostLocal(host)) return null;
  return new Response(MENSAJE_HOST_NO_LOCAL, {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
