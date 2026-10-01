// Prueba de mutación de RLS y triggers, SOLO contra la base local.
//
// Para cada mutación: la aplica con `supabase db query --local`, confirma con una
// consulta de solo lectura que quedó aplicada, corre `npm run test:rls`, anota
// qué pruebas fallaron y SIEMPRE corre `npm run db:reset` (try/finally).
// Antes de aplicar nada comprueba que la base esté en su estado normal; al final
// reinicia una vez más y lo vuelve a comprobar.
//
// Los nombres de las pruebas que fallan se imprimen y se agregan a
// ../informes/mutacion-log.md (C:\dev\informes\mutacion-log.md) al terminar
// cada mutación, sin esperar al final.
//
// Uso: node scripts/mutacion.mjs [--solo 1,2,4,4b]
//
// Código de salida: 0 si todas fueron MATADAS y el estado final es normal;
// 1 si hubo errores (aunque además alguna sobreviviera); 2 si alguna SOBREVIVIÓ.

import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOG = resolve(RAIZ, "..", "informes", "mutacion-log.md");

const POLITICA_USUARIOS = '"usuarios: leer según rol y cadena de mando"';

// Política de lectura de usuarios tal como está en la migración, con la rama
// de subordinados que se puede alterar.
function politicaUsuarios(ramaSubordinados) {
  return `
alter policy ${POLITICA_USUARIOS} on public.usuarios
  using (
    id in (select yo.id from privado.usuario_actual() yo)
    or id in (${ramaSubordinados})
    or (
      exists (select 1 from privado.usuario_actual() yo where yo.rol = 'DIRECTOR_REGIONAL')
      and privado.sucursal_visible(sucursal_id)
    )
  );`;
}

const definicion = (firma) => `pg_get_functiondef('${firma}'::regprocedure)`;

const MUTACIONES = [
  {
    id: "1",
    nombre: "1. Política de usuarios con using (true)",
    sql: `alter policy ${POLITICA_USUARIOS} on public.usuarios using (true);`,
    comprobar: `select qual = 'true' as ok from pg_policies
                where schemaname = 'public' and tablename = 'usuarios' and policyname = 'usuarios: leer según rol y cadena de mando'`,
  },
  {
    id: "2",
    nombre: "2. usuario_actual() sin 'and u.activo'",
    sql: `
create or replace function privado.usuario_actual()
returns setof public.usuarios
language sql stable security definer set search_path = '' rows 1
as $$
  select u.* from public.usuarios u where u.auth_id = (select auth.uid());
$$;`,
    comprobar: `select position('u.activo' in ${definicion("privado.usuario_actual()")}) = 0 as ok`,
  },
  {
    id: "3",
    nombre: "3. sucursal_visible: director sin límite de organización",
    sql: `
create or replace function privado.sucursal_visible(p_sucursal uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from privado.usuario_actual() yo
    join public.sucursales mia on mia.id = yo.sucursal_id
    join public.sucursales s on s.id = p_sucursal
    where s.id = yo.sucursal_id
       or (yo.rol = 'DIRECTOR_REGIONAL')
       or (yo.rol = 'GERENTE'
           and exists (
             select 1 from public.usuarios sub
             where sub.id in (select privado.subordinados(yo.id))
               and sub.sucursal_id = s.id
           ))
  );
$$;`,
    comprobar: `select position('s.organizacion_id = mia.organizacion_id' in ${definicion("privado.sucursal_visible(uuid)")}) = 0 as ok`,
  },
  {
    id: "4",
    nombre: "4. Escritura en usuarios para authenticated (grant + política for all)",
    sql: [
      `grant insert, update, delete on public.usuarios to authenticated`,
      `create policy "mutacion: escribir todo" on public.usuarios
         for all to authenticated using (true) with check (true)`,
    ],
    comprobar: `select has_table_privilege('authenticated', 'public.usuarios', 'INSERT')
                   and has_table_privilege('authenticated', 'public.usuarios', 'UPDATE')
                   and has_table_privilege('authenticated', 'public.usuarios', 'DELETE')
                   and exists (select 1 from pg_policies where tablename = 'usuarios' and policyname = 'mutacion: escribir todo') as ok`,
  },
  {
    id: "4b",
    nombre: "4b. Escritura en usuarios para authenticated (grant + políticas separadas de insert, update y delete)",
    sql: [
      `grant insert, update, delete on public.usuarios to authenticated`,
      `create policy "mutacion: insertar" on public.usuarios
         for insert to authenticated with check (true)`,
      `create policy "mutacion: actualizar" on public.usuarios
         for update to authenticated using (true) with check (true)`,
      `create policy "mutacion: borrar" on public.usuarios
         for delete to authenticated using (true)`,
    ],
    // Además de las tres políticas nuevas, la de lectura sigue intacta.
    comprobar: `select has_table_privilege('authenticated', 'public.usuarios', 'INSERT')
                   and has_table_privilege('authenticated', 'public.usuarios', 'UPDATE')
                   and has_table_privilege('authenticated', 'public.usuarios', 'DELETE')
                   and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'usuarios'
                          and (policyname, cmd) in (('mutacion: insertar', 'INSERT'),
                                                    ('mutacion: actualizar', 'UPDATE'),
                                                    ('mutacion: borrar', 'DELETE'))) = 3
                   and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'usuarios'
                          and cmd = 'SELECT' and policyname = 'usuarios: leer según rol y cadena de mando'
                          and position('GERENTE' in qual) > 0) = 1 as ok`,
  },
  {
    id: "5",
    nombre: "5. Lectura de usuarios para anon (grant + política)",
    sql: [
      `grant select on public.usuarios to anon`,
      `create policy "mutacion: anon lee todo" on public.usuarios
         for select to anon using (true)`,
    ],
    comprobar: `select has_table_privilege('anon', 'public.usuarios', 'SELECT')
                   and exists (select 1 from pg_policies where tablename = 'usuarios' and policyname = 'mutacion: anon lee todo') as ok`,
  },
  {
    id: "6",
    nombre: "6. Sin trigger usuarios_validar_cadena_de_mando",
    sql: `drop trigger usuarios_validar_cadena_de_mando on public.usuarios;`,
    comprobar: `select not exists (select 1 from pg_trigger where tgname = 'usuarios_validar_cadena_de_mando') as ok`,
  },
  {
    id: "7",
    nombre: "7. Sin trigger sucursales_impedir_cambio_organizacion",
    sql: `drop trigger sucursales_impedir_cambio_organizacion on public.sucursales;`,
    comprobar: `select not exists (select 1 from pg_trigger where tgname = 'sucursales_impedir_cambio_organizacion') as ok`,
  },
  {
    id: "8",
    nombre: "8. subordinados solo devuelve subordinados directos",
    sql: `
create or replace function privado.subordinados(p_jefe uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  with
  org_jefe as (
    select s.organizacion_id
    from public.usuarios u
    join public.sucursales s on s.id = u.sucursal_id
    where u.id = p_jefe
  ),
  abajo (id) as (
    select u.id
    from public.usuarios u
    join public.sucursales s on s.id = u.sucursal_id
    join org_jefe o on o.organizacion_id = s.organizacion_id
    where u.jefe_id = p_jefe
  )
  select a.id
  from abajo a
  where exists (
    select 1
    from privado.usuario_actual() yo
    join public.sucursales mia on mia.id = yo.sucursal_id
    join org_jefe o on o.organizacion_id = mia.organizacion_id
  );
$$;`,
    comprobar: `select position('join abajo' in ${definicion("privado.subordinados(uuid)")}) = 0 as ok`,
  },
  {
    id: "9",
    nombre: "9. Política de usuarios sin 'where yo.rol = GERENTE' en subordinados",
    sql: politicaUsuarios("select privado.subordinados(yo.id) from privado.usuario_actual() yo"),
    comprobar: `select position('GERENTE' in qual) = 0 as ok from pg_policies
                where schemaname = 'public' and tablename = 'usuarios' and policyname = 'usuarios: leer según rol y cadena de mando'`,
  },
];

// Estado normal esperado después de db:reset.
const COMPROBACIONES_FINALES = [
  {
    nombre: "1 política de lectura por tabla y ninguna de escritura",
    sql: `select count(*) = 3
                 and count(*) filter (where cmd = 'SELECT') = 3
                 and count(distinct tablename) = 3 as ok
          from pg_policies where schemaname = 'public'`,
  },
  {
    nombre: "authenticated solo tiene SELECT y anon nada en las tres tablas",
    sql: `select bool_and(has_table_privilege('authenticated', t, 'SELECT'))
                 and not bool_or(has_table_privilege('authenticated', t, 'INSERT')
                              or has_table_privilege('authenticated', t, 'UPDATE')
                              or has_table_privilege('authenticated', t, 'DELETE'))
                 and not bool_or(has_table_privilege('anon', t, 'SELECT')) as ok
          from unnest(array['public.organizaciones', 'public.sucursales', 'public.usuarios']) t`,
  },
  {
    nombre: "las tres funciones de privado",
    sql: `select array_agg(p.proname::text order by p.proname)
                 = array['subordinados', 'sucursal_visible', 'usuario_actual'] as ok
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'privado'`,
  },
  {
    nombre: "las definiciones de privado son las originales",
    sql: `select position('u.activo' in ${definicion("privado.usuario_actual()")}) > 0
                 and position('s.organizacion_id = mia.organizacion_id' in ${definicion("privado.sucursal_visible(uuid)")}) > 0
                 and position('join abajo' in ${definicion("privado.subordinados(uuid)")}) > 0 as ok`,
  },
  {
    nombre: "los triggers",
    sql: `select array_agg(tgname::text order by tgname) = array[
                   'organizaciones_fijar_actualizado_en',
                   'sucursales_fijar_actualizado_en',
                   'sucursales_impedir_cambio_organizacion',
                   'usuarios_fijar_actualizado_en',
                   'usuarios_validar_cadena_de_mando'] as ok
          from pg_trigger
          where not tgisinternal
            and tgrelid in ('public.organizaciones'::regclass, 'public.sucursales'::regclass, 'public.usuarios'::regclass)`,
  },
];

const temporal = mkdtempSync(join(tmpdir(), "mutacion-"));

// Todo corre con spawn asíncrono para que el event loop quede libre y los
// manejadores de SIGINT/SIGTERM se ejecuten de inmediato.
let hijoActual = null;

function correr(comando) {
  return new Promise((listo) => {
    const hijo = spawn(comando, { shell: true });
    hijoActual = hijo;
    let salida = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (salida += d));
    hijo.on("close", (codigo) => {
      hijoActual = null;
      listo({ codigo, salida });
    });
  });
}

function alInterrumpir(senal) {
  console.error(`\n${senal} recibido. La base local puede estar mutada; corre npm run db:reset`);
  // Corta el comando en curso (en Windows, con todo su árbol de procesos).
  if (hijoActual?.pid) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(hijoActual.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        hijoActual.kill("SIGTERM");
      }
    } catch {
      // Si no se puede cortar, igual salimos: el mensaje ya pide el reset.
    }
  }
  anotar(`\n**Interrumpido por ${senal}.** La base local puede estar mutada; corre npm run db:reset.\n`);
  process.exit(1);
}
process.on("SIGINT", () => alInterrumpir("SIGINT"));
process.on("SIGTERM", () => alInterrumpir("SIGTERM"));

function anotar(texto) {
  try {
    mkdirSync(dirname(LOG), { recursive: true });
    appendFileSync(LOG, texto, "utf8");
  } catch (e) {
    console.error(`  (no se pudo escribir en ${LOG}: ${e.message})`);
  }
}

function abortar(mensaje) {
  console.error(`\nABORTADO: ${mensaje}`);
  anotar(`\n**ABORTADO:** ${mensaje}\n`);
  rmSync(temporal, { recursive: true, force: true });
  process.exit(1);
}

function elegirMutaciones() {
  const i = process.argv.indexOf("--solo");
  if (i < 0) return MUTACIONES;
  const pedidas = (process.argv[i + 1] ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const validas = MUTACIONES.map((m) => m.id);
  const desconocidas = pedidas.filter((id) => !validas.includes(id));
  if (pedidas.length === 0 || desconocidas.length > 0) {
    abortar(
      `--solo necesita una lista de mutaciones separadas por comas. ` +
        `Desconocidas: ${desconocidas.join(", ") || "(lista vacía)"}. Válidas: ${validas.join(", ")}.`,
    );
  }
  return MUTACIONES.filter((m) => pedidas.includes(m.id));
}

async function verificarLocal() {
  const { codigo, salida } = await correr("npx supabase status -o json");
  if (codigo !== 0) abortar("supabase status falló. Arranca la base con npm run db:start.");
  const json = JSON.parse(salida.slice(salida.indexOf("{"), salida.lastIndexOf("}") + 1));
  for (const clave of ["API_URL", "DB_URL"]) {
    const host = new URL(json[clave]).hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      abortar(`${clave} apunta a "${host}", no a la base local. No se aplica ninguna mutación.`);
    }
  }
}

// Ejecuta SQL en la base local desde un archivo y devuelve las filas.
async function consultar(sql, nombre) {
  const archivo = join(temporal, `${nombre}.sql`);
  writeFileSync(archivo, sql, "utf8");
  const { codigo, salida } = await correr(`npx supabase db query --local --output-format json --file "${archivo}"`);
  if (codigo !== 0) throw new Error(`la consulta falló:\n${salida}`);
  const inicio = salida.indexOf("{");
  if (inicio < 0) return [];
  return JSON.parse(salida.slice(inicio, salida.lastIndexOf("}") + 1)).rows ?? [];
}

async function comprobar(sql, nombre) {
  const filas = await consultar(sql, nombre);
  return filas.length === 1 && filas[0].ok === true;
}

async function comprobarEstadoNormal(etapa) {
  const resultados = [];
  for (const [i, c] of COMPROBACIONES_FINALES.entries()) {
    resultados.push({ nombre: c.nombre, ok: await comprobar(c.sql, `${etapa}-${i + 1}`) });
  }
  return resultados;
}

async function correrPruebas() {
  const reporte = join(temporal, "reporte.json");
  rmSync(reporte, { force: true });
  const { codigo, salida } = await correr(`npm run test:rls -- --reporter=json --outputFile="${reporte}"`);
  let fallidas = [];
  try {
    const json = JSON.parse(readFileSync(reporte, "utf8"));
    fallidas = json.testResults.flatMap((archivo) =>
      archivo.assertionResults.filter((p) => p.status === "failed").map((p) => p.fullName),
    );
    // Archivos que fallaron sin pruebas individuales (p. ej. en un beforeAll).
    for (const archivo of json.testResults) {
      if (archivo.status === "failed" && !archivo.assertionResults.some((p) => p.status === "failed")) {
        fallidas.push(`(archivo ${archivo.name.split(/[\\/]/).pop()}: ${archivo.message || "falló"})`);
      }
    }
  } catch {
    fallidas = [`(sin reporte; código ${codigo}: ${salida.trim().split("\n").slice(-3).join(" ")})`];
  }
  if (codigo !== 0 && fallidas.length === 0) fallidas = [`(npm run test:rls salió con código ${codigo})`];
  return fallidas;
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Después de un reset, auth, storage y realtime tardan en volver. Si las
// pruebas arrancan antes, fallarían por eso y no por la mutación.
async function esperarContenedoresSanos() {
  for (let intento = 0; intento < 60; intento++) {
    const { salida } = await correr('docker ps --filter "name=_crediflexi" --format "{{.Status}}"');
    if (salida.trim() !== "" && !/starting|unhealthy|Restarting/i.test(salida)) return;
    await dormir(2000);
  }
  throw new Error("los contenedores de Supabase no quedaron sanos después de 2 minutos");
}

async function reiniciar() {
  let ultimo = "";
  for (let intento = 1; intento <= 3; intento++) {
    await esperarContenedoresSanos();
    const { codigo, salida } = await correr("npm run db:reset");
    if (codigo === 0) {
      await esperarContenedoresSanos();
      return;
    }
    ultimo = salida;
    console.log(`  db:reset falló (intento ${intento} de 3); reintentando…`);
    await dormir(5000);
  }
  throw new Error(`npm run db:reset falló 3 veces:\n${ultimo}`);
}

const elegidas = elegirMutaciones();
await verificarLocal();
await esperarContenedoresSanos();

anotar(
  `\n## Corrida ${new Date().toLocaleString("es-MX")} — --solo ${elegidas.map((m) => m.id).join(",")}\n`,
);

// Antes de aplicar nada, la base debe estar en su estado normal.
const iniciales = await comprobarEstadoNormal("inicial");
const malas = iniciales.filter((c) => !c.ok);
if (malas.length > 0) {
  abortar(
    `la base local no está en su estado normal (${malas.map((c) => c.nombre).join("; ")}). ` +
      "No se aplicó ninguna mutación. Corre npm run db:reset y vuelve a intentarlo.",
  );
}
console.log("Estado inicial normal; empiezan las mutaciones.");

const resultados = [];
for (const m of elegidas) {
  console.log(`\n▶ ${m.nombre}`);
  const resultado = { nombre: m.nombre, estado: "ERROR", fallidas: [] };
  try {
    // La CLI no acepta varias sentencias en una consulta: van una por una.
    for (const [j, sentencia] of [m.sql].flat().entries()) await consultar(sentencia, `mutacion-${m.id}-${j + 1}`);
    if (!(await comprobar(m.comprobar, `comprobar-${m.id}`))) {
      throw new Error("la consulta de comprobación dice que la mutación no quedó aplicada");
    }
    console.log("  aplicada y comprobada; corriendo npm run test:rls…");
    resultado.fallidas = await correrPruebas();
    resultado.estado = resultado.fallidas.length > 0 ? "MATADA" : "SOBREVIVIÓ";
  } catch (e) {
    resultado.fallidas = [`(error: ${e.message})`];
  }

  // De inmediato: a la consola y al log.
  console.log(`  ${resultado.estado} (${resultado.fallidas.length} pruebas fallaron)`);
  for (const f of resultado.fallidas) console.log(`    - ${f}`);
  anotar(
    `\n### ${m.nombre}\n\n**${resultado.estado}** — ${resultado.fallidas.length} pruebas fallaron\n\n` +
      resultado.fallidas.map((f) => `- ${f}`).join("\n") +
      (resultado.fallidas.length > 0 ? "\n" : ""),
  );
  resultados.push(resultado);

  console.log("  npm run db:reset…");
  try {
    await reiniciar();
  } catch (e) {
    abortar(`${e.message}\nLa base local puede haber quedado mutada; corre npm run db:reset a mano.`);
  }
}

console.log("\n▶ Reinicio final y comprobación del estado normal");
try {
  await reiniciar();
} catch (e) {
  abortar(`${e.message}\nCorre npm run db:reset a mano.`);
}
const finales = await comprobarEstadoNormal("final");
rmSync(temporal, { recursive: true, force: true });

console.log("\n| Mutación | Resultado | Pruebas que fallaron |");
console.log("|---|---|---|");
for (const r of resultados) {
  const lista = r.fallidas.length > 0 ? `${r.fallidas.length}: ${r.fallidas.join("<br>")}` : "ninguna";
  console.log(`| ${r.nombre} | ${r.estado} | ${lista} |`);
}

console.log("\n| Estado final | Resultado |");
console.log("|---|---|");
for (const f of finales) console.log(`| ${f.nombre} | ${f.ok ? "OK" : "FALLA"} |`);

anotar(
  `\n**Estado final:** ${finales.every((f) => f.ok) ? "normal" : "ANORMAL"} ` +
    `(${finales.map((f) => `${f.nombre}: ${f.ok ? "OK" : "FALLA"}`).join("; ")})\n`,
);

const hayErrores = resultados.some((r) => r.estado === "ERROR") || !finales.every((f) => f.ok);
const sobrevivio = resultados.some((r) => r.estado === "SOBREVIVIÓ");
process.exit(hayErrores ? 1 : sobrevivio ? 2 : 0);
