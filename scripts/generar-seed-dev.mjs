// Genera el seed de usuarios de DESARROLLO para Supabase local.
//
//   npm run seed:dev                              contraseña aleatoria
//   npm run seed:dev -- --contrasena <contraseña> contraseña elegida
//
// Escribe supabase/seeds/local/usuarios_dev.sql, que git ignora: la contraseña
// nunca se sube. config.toml lo carga con un glob, así que `npm run db:reset`
// lo aplica después de las migraciones (y no falla si el archivo no existe).
//
// Crea la "Organización de Prueba" con una sucursal y cuatro usuarios ficticios
// con la misma contraseña: director -> gerente -> dos ejecutivos. El seed corre
// como postgres, así que escribe en auth.users sin pasar por RLS ni por las
// reglas de contraseña de Auth: por eso aquí se validan el largo mínimo (error)
// y los tipos de carácter (aviso).

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { generarContrasena } from "./contrasena.mjs";

export const RUTA_SEED = "supabase/seeds/local/usuarios_dev.sql";

const ORGANIZACION = { id: "0000d000-0000-4000-8000-000000000001", nombre: "Organización de Prueba" };
const SUCURSAL = { id: "0000d000-0000-4000-8000-000000000002", nombre: "Sucursal de Prueba" };

/** Usuarios ficticios. Cada jefe va antes que sus subordinados (lo exige el trigger de cadena de mando). */
export const USUARIOS_DEV = [
  { clave: "director", correo: "director@prueba.local", nombre: "Director de Prueba", rol: "DIRECTOR_REGIONAL", jefe: null, n: 1 },
  { clave: "gerente", correo: "gerente@prueba.local", nombre: "Gerente de Prueba", rol: "GERENTE", jefe: "director", n: 2 },
  { clave: "ejecutivo1", correo: "ejecutivo1@prueba.local", nombre: "Ejecutivo de Prueba Uno", rol: "EJECUTIVO", jefe: "gerente", n: 3 },
  { clave: "ejecutivo2", correo: "ejecutivo2@prueba.local", nombre: "Ejecutivo de Prueba Dos", rol: "EJECUTIVO", jefe: "gerente", n: 4 },
];

const LARGO_MINIMO = 12; // minimum_password_length de supabase/config.toml
const ROL_LEGIBLE = { DIRECTOR_REGIONAL: "Director regional", GERENTE: "Gerente", EJECUTIVO: "Ejecutivo" };

const idAuth = (n) => `0000d000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
const idUsuario = (n) => `0000d000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`;
const literal = (texto) => `'${texto.replaceAll("'", "''")}'`;

/** Lanza si es muy corta; devuelve avisos si no cumple password_requirements (lower_upper_letters_digits). */
export function validarContrasena(contrasena) {
  if (contrasena.length < LARGO_MINIMO) {
    throw new Error(`La contraseña debe tener al menos ${LARGO_MINIMO} caracteres (tiene ${contrasena.length}).`);
  }
  const avisos = [];
  if (!/[a-z]/.test(contrasena)) avisos.push("no tiene minúscula");
  if (!/[A-Z]/.test(contrasena)) avisos.push("no tiene mayúscula");
  if (!/[0-9]/.test(contrasena)) avisos.push("no tiene dígito");
  return avisos;
}

export function parsearArgumentos(argv) {
  let contrasena = null;
  for (let i = 0; i < argv.length; i++) {
    const m = /^--contrasena(?:=(.*))?$/.exec(argv[i]);
    if (!m) throw new Error(`Bandera desconocida: ${argv[i]}. Usa --contrasena <contraseña> o ninguna.`);
    contrasena = m[1] ?? argv[++i] ?? "";
  }
  return { contrasena };
}

/** SQL del seed. La contraseña solo aparece dentro de crypt(): en la base queda el hash bcrypt. */
export function generarSql(contrasena) {
  const ids = Object.fromEntries(USUARIOS_DEV.map((u) => [u.clave, u.n]));
  const cuentas = USUARIOS_DEV.map(
    (u) => `  (${literal(idAuth(u.n))}, ${literal(u.correo)})`,
  ).join(",\n");
  const usuarios = USUARIOS_DEV.map(
    (u) =>
      `  (${literal(idUsuario(u.n))}, ${literal(idAuth(u.n))}, ${literal(u.nombre)}, ${literal(u.rol)}, ${literal(SUCURSAL.id)}, ${
        u.jefe ? literal(idUsuario(ids[u.jefe])) : "null"
      })`,
  );

  return `-- GENERADO por scripts/generar-seed-dev.mjs. NO se sube a git (contiene la
-- contraseña de desarrollo). Solo datos ficticios, solo Supabase local.
-- Para regenerarlo: npm run seed:dev. Para aplicarlo: npm run db:reset.

begin;

insert into public.organizaciones (id, nombre)
values (${literal(ORGANIZACION.id)}, ${literal(ORGANIZACION.nombre)});

insert into public.sucursales (id, organizacion_id, nombre)
values (${literal(SUCURSAL.id)}, ${literal(ORGANIZACION.id)}, ${literal(SUCURSAL.nombre)});

-- Cuentas de Auth con correo ya confirmado. Los campos de token van en '' y no
-- en null: Auth falla al leer null en ellos.
with cuentas (id, correo) as (
  values
${cuentas}
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', c.id::uuid, 'authenticated', 'authenticated', c.correo,
  extensions.crypt(${literal(contrasena)}, extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', '', '', '', '', ''
from cuentas c;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email like '%@prueba.local';

-- En orden: cada jefe antes que sus subordinados.
insert into public.usuarios (id, auth_id, nombre, rol, sucursal_id, jefe_id)
values
${usuarios.join(",\n")};

commit;
`;
}

function principal() {
  try {
    const opciones = parsearArgumentos(process.argv.slice(2));
    const generada = opciones.contrasena === null;
    const contrasena = generada ? generarContrasena() : opciones.contrasena;
    const avisos = validarContrasena(contrasena);

    mkdirSync(path.dirname(RUTA_SEED), { recursive: true });
    writeFileSync(RUTA_SEED, generarSql(contrasena), "utf8");

    const lineas = [
      `Seed de desarrollo escrito en ${RUTA_SEED} (ignorado por git).`,
      ...avisos.map((a) => `Aviso: la contraseña ${a}. Auth no la aceptaría en un registro, pero el seed sí la carga.`),
      "",
      ...USUARIOS_DEV.map((u) => `${ROL_LEGIBLE[u.rol].padEnd(18)} ${u.correo}`),
      generada ? `\nContraseña (los cuatro): ${contrasena}\nCópiala ahora: solo queda dentro de ${RUTA_SEED}.` : "\nContraseña (los cuatro): la que pasaste con --contrasena.",
      "",
      "Siguiente paso: npm run db:reset (BORRA todos los datos locales y aplica migraciones + seed).",
    ];
    process.stdout.write(`${lineas.join("\n")}\n`);
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : "No se pudo generar el seed."}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
