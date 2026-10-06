// Arranca `next dev` o `next start` con la URL y la llave publicable de
// Supabase local en el entorno del proceso hijo.
//
// Las toma de `supabase status -o json` (igual que tests/rls/entorno.ts). Solo
// viven en memoria: no se imprimen, no se escriben en archivos (no hay .env) y
// no llevan el prefijo NEXT_PUBLIC_, así que no llegan al navegador. Si la URL
// no es localhost o 127.0.0.1, se niega a correr.
//
// Uso: node scripts/con-entorno.mjs dev|start [argumentos extra de next]

import { execSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const HOSTS_LOCALES = new Set(["localhost", "127.0.0.1"]);
const MODOS = new Set(["dev", "start"]);

const MENSAJE_NO_CORRE =
  "Supabase local no está corriendo o no respondió. Ejecuta primero: npm run db:start";

export function exigirUrlLocal(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("La URL de Supabase que reporta `supabase status` no es válida. Revisa la instalación local con: npm run db:status");
  }
  if (!HOSTS_LOCALES.has(host)) {
    throw new Error(
      "La app solo corre contra Supabase local (localhost o 127.0.0.1), pero la URL apunta a otro servidor. " +
        "Se abortó para no conectarse a un proyecto en la nube.",
    );
  }
}

export function argumentosNext(modo, extra) {
  if (!MODOS.has(modo)) throw new Error(`Modo desconocido: usa "dev" o "start".`);
  return [modo, "-H", "127.0.0.1", ...extra];
}

export function entornoParaNext(base, url, llavePublicable) {
  return { ...base, SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: llavePublicable };
}

function leerSupabaseLocal() {
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
  if (!url || !llavePublicable) throw new Error(MENSAJE_NO_CORRE);
  exigirUrlLocal(url);
  return { url, llavePublicable };
}

function principal() {
  const [modo, ...extra] = process.argv.slice(2);
  let args;
  let supabase;
  try {
    args = argumentosNext(modo, extra);
    supabase = leerSupabaseLocal();
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : "No se pudo arrancar la app."}\n`);
    process.exit(1);
  }

  const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
  const hijo = spawn(process.execPath, [next, ...args], {
    stdio: "inherit",
    env: entornoParaNext(process.env, supabase.url, supabase.llavePublicable),
  });
  for (const senal of ["SIGINT", "SIGTERM"]) process.on(senal, () => hijo.kill(senal));
  hijo.on("exit", (codigo, senal) => process.exit(codigo ?? (senal ? 1 : 0)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
