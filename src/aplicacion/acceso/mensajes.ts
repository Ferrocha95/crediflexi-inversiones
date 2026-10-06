/**
 * Mensajes de la pantalla de acceso. Ninguno revela si un correo existe: un
 * correo desconocido y una contraseña equivocada dan el mismo mensaje.
 */
export const MENSAJES_ACCESO = {
  credenciales: "Correo o contraseña incorrectos.",
  inactivo: "Tu usuario está inactivo; habla con tu gerente.",
  demasiadosIntentos: "Demasiados intentos; espera unos minutos.",
  sinServicio: "No se pudo conectar con el servicio de acceso. Revisa que Supabase local esté corriendo (npm run db:start) e intenta de nuevo.",
  faltanDatos: "Escribe tu correo y tu contraseña.",
} as const;

/** Lo que importa de un error de Auth: su código y su estado HTTP (0 si no hubo respuesta). */
export interface ErrorAuth {
  readonly code?: string;
  readonly status?: number;
}

const LIMITE_DE_INTENTOS = new Set(["over_request_rate_limit", "over_email_send_rate_limit", "over_sms_send_rate_limit"]);

/** Traduce un error de signInWithPassword a un mensaje en español. */
export function mensajeDeErrorAuth(error: ErrorAuth): string {
  if (error.status === 429 || (error.code !== undefined && LIMITE_DE_INTENTOS.has(error.code))) {
    return MENSAJES_ACCESO.demasiadosIntentos;
  }
  if (error.code === "user_banned") return MENSAJES_ACCESO.inactivo;
  if (error.status === undefined || error.status === 0 || error.status >= 500) return MENSAJES_ACCESO.sinServicio;
  return MENSAJES_ACCESO.credenciales;
}
