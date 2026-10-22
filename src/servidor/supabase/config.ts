import { leerHostsPermitidos } from "../../aplicacion/host";

/**
 * Configuración de la app, leída del entorno del servidor. Ninguna variable
 * lleva el prefijo NEXT_PUBLIC_, así que no llegan al navegador:
 *
 * - SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY. En local las pone en memoria
 *   scripts/con-entorno.mjs al correr `npm run dev` o `npm run start` (no hay
 *   archivos .env); en el despliegue, las variables de entorno del proyecto.
 * - HOSTS_PERMITIDOS: hosts exactos separados por comas. Sin ella, solo los
 *   locales (ver src/aplicacion/host.ts).
 * - ENTORNO: "prueba" (por omisión) o "produccion".
 *
 * Ningún mensaje de error repite los valores recibidos.
 *
 * Sin server-only: también la usan src/proxy.ts y next.config.ts.
 */
export interface ConfigSupabase {
  readonly url: string;
  readonly llavePublicable: string;
}

export type Entorno = "prueba" | "produccion";

export const MENSAJE_SIN_CONFIG =
  "Falta la configuración de Supabase (SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY). " +
  "En tu computadora, arranca la app con npm run dev o npm run start, que la toman de Supabase local; si Supabase no está corriendo, primero npm run db:start. " +
  "En el despliegue, agrégalas en las variables de entorno del proyecto y vuelve a desplegar.";

export const MENSAJE_URL_INVALIDA =
  "SUPABASE_URL no es una dirección http o https válida. Cópiala completa desde la configuración del proyecto de Supabase y vuelve a arrancar.";

export const MENSAJE_ENTORNO_INVALIDO =
  'ENTORNO solo acepta "prueba" o "produccion" (sin acento y en minúsculas); si no la defines, es "prueba". Corrígela en las variables de entorno y vuelve a arrancar.';

function exigirUrlHttp(url: string): void {
  let protocolo: string;
  try {
    protocolo = new URL(url).protocol;
  } catch {
    throw new Error(MENSAJE_URL_INVALIDA);
  }
  if (protocolo !== "http:" && protocolo !== "https:") throw new Error(MENSAJE_URL_INVALIDA);
}

export function configSupabase(): ConfigSupabase {
  const url = process.env.SUPABASE_URL;
  const llavePublicable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !llavePublicable) throw new Error(MENSAJE_SIN_CONFIG);
  exigirUrlHttp(url);
  return { url, llavePublicable };
}

/** "prueba" si ENTORNO no está definida; cualquier valor distinto de los dos es un error. */
export function entornoActual(): Entorno {
  const valor = process.env.ENTORNO;
  if (valor === undefined) return "prueba";
  if (valor === "prueba" || valor === "produccion") return valor;
  throw new Error(MENSAJE_ENTORNO_INVALIDO);
}

/** La lista de HOSTS_PERMITIDOS, o null (solo locales) si no está definida. Lanza si está mal formada. */
export function hostsPermitidos(): readonly string[] | null {
  return leerHostsPermitidos(process.env.HOSTS_PERMITIDOS);
}

/**
 * La llama next.config.ts al cargarse, así que una configuración mal formada
 * hace fallar `next build`, `next start` y `next dev` en vez de abrir la app
 * por accidente. No exige las variables de Supabase (next build no las
 * necesita), pero si SUPABASE_URL viene, debe ser http o https.
 */
export function validarConfiguracionDeArranque(): void {
  hostsPermitidos();
  entornoActual();
  const url = process.env.SUPABASE_URL;
  if (url) exigirUrlHttp(url);
}
