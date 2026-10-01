// Lectura del entorno de Supabase local para las pruebas de RLS.
//
// Las llaves salen de `supabase status -o json` y nunca se imprimen: la salida
// del comando no llega a la consola y los errores no la reenvían. Si la URL no
// es localhost o 127.0.0.1, se aborta para no tocar jamás un proyecto en la nube.
//
// Sin dependencias de Vitest: lo usan tanto setup-global.ts (fuera de los
// workers) como admin.ts (dentro de los workers).

import { execSync } from "node:child_process";

export const MENSAJE_NO_CORRE =
  "Supabase local no está corriendo. Ejecuta: npm run db:start";

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1"]);

export const OPCIONES_CLIENTE = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

export interface EntornoLocal {
  url: string;
  llavePublicable: string;
  llaveSecreta: string;
}

export function leerEntornoLocal(): EntornoLocal {
  let salida: string;
  try {
    // stdio en "pipe": nada de la salida (que incluye llaves) llega a la consola.
    salida = execSync("npx supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    // No se reenvía el error original: podría contener la salida del comando.
    throw new Error(MENSAJE_NO_CORRE);
  }

  let estado: Record<string, unknown>;
  try {
    estado = JSON.parse(salida) as Record<string, unknown>;
  } catch {
    throw new Error(MENSAJE_NO_CORRE);
  }

  const texto = (clave: string): string | undefined => {
    const valor = estado[clave];
    return typeof valor === "string" && valor !== "" ? valor : undefined;
  };

  const url = texto("API_URL");
  const llavePublicable = texto("PUBLISHABLE_KEY") ?? texto("ANON_KEY");
  const llaveSecreta = texto("SECRET_KEY") ?? texto("SERVICE_ROLE_KEY");

  if (!url) {
    throw new Error(MENSAJE_NO_CORRE);
  }
  if (!llavePublicable || !llaveSecreta) {
    throw new Error(
      "No se encontraron las llaves de Supabase local en `supabase status`. " +
        "Revisa que Supabase local esté completo con: npm run db:status",
    );
  }

  exigirUrlLocal(url);

  return { url, llavePublicable, llaveSecreta };
}

export function exigirUrlLocal(url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(
      "La URL de Supabase que reporta `supabase status` no es válida. " +
        "Revisa la instalación local con: npm run db:status",
    );
  }
  if (!HOSTS_LOCALES.has(host)) {
    throw new Error(
      "Las pruebas de RLS solo corren contra Supabase local (localhost o 127.0.0.1), " +
        "pero la URL apunta a otro servidor. Se abortó para no tocar un proyecto en la nube.",
    );
  }
}
