/** Pantalla de acceso y todo lo que cuelga de ella (por ejemplo, /acceso/salir). */
export const RUTA_ACCESO = "/acceso";

/**
 * Archivos de la carpeta public. Se sirven sin sesión. Una prueba revisa que
 * esta lista coincida con la carpeta: si agregas un archivo, agrégalo aquí.
 */
export const ARCHIVOS_PUBLICOS: ReadonlySet<string> = new Set([
  "/logo-blanco.png",
  "/logo-crediflexi.png",
  "/logo-encabezado-excel.png",
]);

const PREFIJOS_ESTATICOS = ["/_next/static/", "/_next/image"];

/**
 * true si la ruta queda fuera del refresco de sesión del proxy: la pantalla de
 * acceso, los estáticos de Next, el ícono y los archivos de public. La
 * revisión es aquí y no con un matcher, para poder probarla.
 */
export function rutaSinRefresco(pathname: string): boolean {
  if (pathname === RUTA_ACCESO || pathname.startsWith(`${RUTA_ACCESO}/`)) return true;
  if (pathname === "/favicon.ico") return true;
  if (PREFIJOS_ESTATICOS.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`))) return true;
  return ARCHIVOS_PUBLICOS.has(pathname);
}
