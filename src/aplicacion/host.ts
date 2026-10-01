const RE_HOST_LOCAL = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::(\d{1,5}))?$/i;

/**
 * true si el encabezado Host apunta a esta misma máquina: localhost, 127.0.0.1
 * o [::1], con o sin puerto (1 a 65535).
 *
 * NO es seguridad: el navegador o cualquier cliente puede mandar el Host que
 * quiera. Solo es un seguro contra un despliegue accidental de esta versión,
 * que es solo local (sin login y sin base de datos).
 */
export function esHostLocal(host: string | null | undefined): boolean {
  if (host === null || host === undefined) return false;
  const m = RE_HOST_LOCAL.exec(host);
  if (m === null) return false;
  if (m[1] === undefined) return true;
  const puerto = Number(m[1]);
  return puerto >= 1 && puerto <= 65535;
}
