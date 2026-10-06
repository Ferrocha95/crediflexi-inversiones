const ORIGEN_FICTICIO = "http://local.invalid";
const LARGO_MAXIMO = 2048;

/**
 * Ruta a la que se vuelve después de entrar. Solo acepta una ruta relativa y
 * local: empieza con una sola "/", sin "\" ni caracteres de control, y al
 * resolverla no cambia de origen. Tampoco regresa a /acceso. En cualquier otro
 * caso devuelve el inicio ("/"), para que nadie use el formulario de acceso
 * como redirección abierta (//evil, https://…, /\evil).
 */
export function siguienteSeguro(valor: unknown): string {
  if (typeof valor !== "string" || valor.length === 0 || valor.length > LARGO_MAXIMO) return "/";
  if (!valor.startsWith("/") || valor.startsWith("//")) return "/";
  if (/[\\\u0000-\u001f\u007f]/.test(valor)) return "/";
  // Codificadas, "/" y "\" podrían decodificarse más adelante en otra ruta.
  if (/%(2f|5c)/i.test(valor)) return "/";

  let url: URL;
  try {
    url = new URL(valor, ORIGEN_FICTICIO);
  } catch {
    return "/";
  }
  if (url.origin !== ORIGEN_FICTICIO) return "/";
  if (url.pathname === "/acceso" || url.pathname.startsWith("/acceso/")) return "/";
  return valor;
}
