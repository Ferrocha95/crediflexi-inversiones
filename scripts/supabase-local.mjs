// Lectura de Supabase local para los scripts (scripts/con-entorno.mjs y
// scripts/crear-usuarios-sinteticos.mjs), igual que tests/rls/entorno.ts.
//
// Las llaves salen de `supabase status -o json` y solo viven en memoria: la
// salida del comando no llega a la consola y los errores no la reenvían. Si la
// URL no es localhost o 127.0.0.1, se niega a seguir.

import { execSync } from "node:child_process";

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1"]);

export const MENSAJE_NO_CORRE = "Supabase local no está corriendo o no respondió. Ejecuta primero: npm run db:start";

export function exigirUrlLocal(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("La URL de Supabase que reporta `supabase status` no es válida. Revisa la instalación local con: npm run db:status");
  }
  if (!HOSTS_LOCALES.has(host)) {
    throw new Error(
      "Solo se trabaja con Supabase local (localhost o 127.0.0.1), pero la URL apunta a otro servidor. " +
        "Se abortó para no conectarse a un proyecto en la nube.",
    );
  }
}

/**
 * URL y llave publicable; con `{ secreta: true }`, también la llave de
 * servicio. Nunca se imprimen.
 */
export function leerSupabaseLocal({ secreta = false } = {}) {
  let estado;
  try {
    // stdio en "pipe": la salida (que incluye llaves) no llega a la consola.
    const salida = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    estado = JSON.parse(salida);
  } catch {
    // No se reenvía el error original: podría contener la salida del comando.
    throw new Error(MENSAJE_NO_CORRE);
  }
  const texto = (clave) => (typeof estado[clave] === "string" && estado[clave] !== "" ? estado[clave] : undefined);
  const url = texto("API_URL");
  const llavePublicable = texto("PUBLISHABLE_KEY") ?? texto("ANON_KEY");
  const llaveSecreta = secreta ? (texto("SECRET_KEY") ?? texto("SERVICE_ROLE_KEY")) : undefined;
  if (!url || !llavePublicable || (secreta && !llaveSecreta)) throw new Error(MENSAJE_NO_CORRE);
  exigirUrlLocal(url);
  return secreta ? { url, llavePublicable, llaveSecreta } : { url, llavePublicable };
}
