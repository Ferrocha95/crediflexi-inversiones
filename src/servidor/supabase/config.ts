/**
 * URL y llave publicable de Supabase, leídas del entorno del servidor. Las pone
 * en memoria scripts/con-entorno.mjs al correr `npm run dev` o `npm run start`:
 * no hay archivos .env y nunca llevan el prefijo NEXT_PUBLIC_, así que no
 * llegan al navegador.
 *
 * Sin server-only: también la usa src/proxy.ts.
 */
export interface ConfigSupabase {
  readonly url: string;
  readonly llavePublicable: string;
}

export const MENSAJE_SIN_CONFIG =
  "Falta la configuración de Supabase (SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY). " +
  "Arranca la app con npm run dev o npm run start, que la toman de Supabase local; si Supabase no está corriendo, primero npm run db:start.";

export function configSupabase(): ConfigSupabase {
  const url = process.env.SUPABASE_URL;
  const llavePublicable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !llavePublicable) throw new Error(MENSAJE_SIN_CONFIG);
  return { url, llavePublicable };
}
