// Arranca `next dev` o `next start` con la URL y la llave publicable de
// Supabase local en el entorno del proceso hijo.
//
// Las toma de `supabase status -o json` (igual que tests/rls/entorno.ts). Solo
// viven en memoria: no se imprimen, no se escriben en archivos (no hay .env) y
// no llevan el prefijo NEXT_PUBLIC_, así que no llegan al navegador. Si la URL
// no es localhost o 127.0.0.1, se niega a correr.
//
// Uso: node scripts/con-entorno.mjs dev|start [argumentos extra de next]

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { exigirUrlLocal, leerSupabaseLocal } from "./supabase-local.mjs";

export { exigirUrlLocal };

const MODOS = new Set(["dev", "start"]);

export function argumentosNext(modo, extra) {
  if (!MODOS.has(modo)) throw new Error(`Modo desconocido: usa "dev" o "start".`);
  return [modo, "-H", "127.0.0.1", ...extra];
}

export function entornoParaNext(base, url, llavePublicable) {
  return { ...base, SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: llavePublicable };
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
