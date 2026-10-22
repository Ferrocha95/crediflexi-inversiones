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
// 1 si hubo errores o alguna quedó INCONCLUSA (aunque además alguna
// sobreviviera); 2 si alguna SOBREVIVIÓ.

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

const PROSPECTOS_LEER = '"prospectos: leer según rol y cadena de mando"';
const PROSPECTOS_CREAR = '"prospectos: crear los propios"';
const PROSPECTOS_EDITAR = '"prospectos: editar los propios"';

// Ramas de la política de lectura de prospectos tal como está en la migración
// (dueño, gerente por la cadena, director de la organización).
const RAMA_DUENO = "ejecutivo_id = (select privado.usuario_actual_id())";
const RAMA_GERENTE = `ejecutivo_id in (
      select privado.subordinados(yo.id) from privado.usuario_actual() yo where yo.rol = 'GERENTE'
    )`;
const RAMA_DIRECTOR = `(
      exists (select 1 from privado.usuario_actual() yo where yo.rol = 'DIRECTOR_REGIONAL')
      and ejecutivo_id in (select privado.usuarios_de_mi_organizacion())
    )`;
function politicaProspectos(ramas) {
  return `alter policy ${PROSPECTOS_LEER} on public.prospectos using (${ramas.join(" or ")});`;
}

// Filtro de pg_policies para una política de prospectos (nombre sin comillas).
const politicaDeProspectos = (nombre) =>
  `from pg_policies where schemaname = 'public' and tablename = 'prospectos' and policyname = '${nombre}'`;

const BIBLIOTECA_LEER = '"biblioteca: leer los de mi organización"';
const BIBLIOTECA_CREAR = '"biblioteca: crear Director y Gerente"';

// Filtro de pg_policies para una política de biblioteca (nombre sin comillas).
const politicaDeBiblioteca = (nombre) =>
  `from pg_policies where schemaname = 'public' and tablename = 'biblioteca' and policyname = '${nombre}'`;

const CARPETAS_LEER = '"biblioteca_carpetas: leer las de mi organización"';
const CARPETAS_CREAR = '"biblioteca_carpetas: crear Director y Gerente"';

// Filtro de pg_policies para una política de carpetas (nombre sin comillas).
const politicaDeCarpetas = (nombre) =>
  `from pg_policies where schemaname = 'public' and tablename = 'biblioteca_carpetas' and policyname = '${nombre}'`;

// Columnas, en orden, de la llave foránea de biblioteca hacia carpetas.
const COLUMNAS_LLAVE_CARPETA = `(select array_agg(a.attname::text order by k.n)
           from pg_constraint c
           cross join lateral unnest(c.conkey) with ordinality k (attnum, n)
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
           where c.conrelid = 'public.biblioteca'::regclass and c.contype = 'f'
             and c.confrelid = 'public.biblioteca_carpetas'::regclass)`;

// Filtro de pg_policies para una política del bucket (nombre sin comillas).
const politicaDelBucket = (nombre) =>
  `from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = '${nombre}'`;

// Rama de rol de las políticas de biblioteca tal como está en la migración.
const RAMA_DIRECTOR_O_GERENTE = `exists (
      select 1 from privado.usuario_actual() yo where yo.rol in ('DIRECTOR_REGIONAL', 'GERENTE')
    )`;

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
  {
    id: "10",
    nombre: "10. Lectura de prospectos con using (true)",
    sql: `alter policy ${PROSPECTOS_LEER} on public.prospectos using (true);`,
    comprobar: `select qual = 'true' as ok ${politicaDeProspectos("prospectos: leer según rol y cadena de mando")}`,
  },
  {
    id: "11",
    nombre: "11. Lectura de prospectos sin la rama de subordinados (gerentes)",
    sql: politicaProspectos([RAMA_DUENO, RAMA_DIRECTOR]),
    comprobar: `select position('subordinados' in qual) = 0 as ok ${politicaDeProspectos("prospectos: leer según rol y cadena de mando")}`,
  },
  {
    id: "12",
    nombre: "12. Lectura de prospectos: rama de director sin el filtro de rol",
    sql: politicaProspectos([RAMA_DUENO, RAMA_GERENTE, "ejecutivo_id in (select privado.usuarios_de_mi_organizacion())"]),
    comprobar: `select position('DIRECTOR_REGIONAL' in qual) = 0 as ok ${politicaDeProspectos("prospectos: leer según rol y cadena de mando")}`,
  },
  {
    id: "13",
    nombre: "13. usuarios_de_mi_organizacion() sin el corte por organización",
    sql: `
create or replace function privado.usuarios_de_mi_organizacion()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select u.id
  from privado.usuario_actual() yo
  cross join public.usuarios u;
$$;`,
    comprobar: `select position('mia.organizacion_id' in ${definicion("privado.usuarios_de_mi_organizacion()")}) = 0 as ok`,
  },
  {
    id: "14",
    nombre: "14. Insertar prospectos a nombre de otro (grant insert (ejecutivo_id) + with check (true))",
    sql: [
      `grant insert (ejecutivo_id) on public.prospectos to authenticated`,
      `alter policy ${PROSPECTOS_CREAR} on public.prospectos with check (true)`,
    ],
    comprobar: `select has_column_privilege('authenticated', 'public.prospectos', 'ejecutivo_id', 'INSERT')
                   and (select with_check = 'true' ${politicaDeProspectos("prospectos: crear los propios")}) as ok`,
  },
  {
    id: "15",
    nombre: "15. Editar prospectos con using (true) with check (true)",
    sql: `alter policy ${PROSPECTOS_EDITAR} on public.prospectos using (true) with check (true);`,
    comprobar: `select qual = 'true' and with_check = 'true' as ok ${politicaDeProspectos("prospectos: editar los propios")}`,
  },
  {
    id: "16",
    nombre: "16. Reasignar prospectos (sin trigger prospectos_impedir_reasignar + grant update (ejecutivo_id))",
    sql: [
      `drop trigger prospectos_impedir_reasignar on public.prospectos`,
      `grant update (ejecutivo_id) on public.prospectos to authenticated`,
    ],
    comprobar: `select not exists (select 1 from pg_trigger where tgname = 'prospectos_impedir_reasignar')
                   and has_column_privilege('authenticated', 'public.prospectos', 'ejecutivo_id', 'UPDATE') as ok`,
  },
  {
    id: "17",
    nombre: "17. Borrar prospectos (grant delete + política for delete using (true))",
    sql: [
      `grant delete on public.prospectos to authenticated`,
      `create policy "mutacion: borrar prospectos" on public.prospectos
         for delete to authenticated using (true)`,
    ],
    comprobar: `select has_table_privilege('authenticated', 'public.prospectos', 'DELETE')
                   and exists (select 1 ${politicaDeProspectos("mutacion: borrar prospectos")}) as ok`,
  },
  {
    id: "18",
    nombre: "18. parece_dato_sensible() devuelve siempre null",
    sql: `
create or replace function privado.parece_dato_sensible(p_texto text)
returns text
language sql immutable set search_path = ''
as $$
  select null::text;
$$;`,
    comprobar: `select position('CLABE' in ${definicion("privado.parece_dato_sensible(text)")}) = 0 as ok`,
  },
  {
    id: "19",
    nombre: "19. Lectura de biblioteca sin el filtro de organización",
    sql: `alter policy ${BIBLIOTECA_LEER} on public.biblioteca using (archivado_en is null or ${RAMA_DIRECTOR_O_GERENTE});`,
    comprobar: `select position('organizacion_actual_id' in qual) = 0 as ok ${politicaDeBiblioteca("biblioteca: leer los de mi organización")}`,
  },
  {
    id: "20",
    nombre: "20. Insertar en biblioteca sin comprobar el rol",
    sql: `alter policy ${BIBLIOTECA_CREAR} on public.biblioteca
            with check (
              subido_por = (select privado.usuario_actual_id())
              and organizacion_id = (select privado.organizacion_actual_id())
            );`,
    comprobar: `select position('GERENTE' in with_check) = 0 as ok ${politicaDeBiblioteca("biblioteca: crear Director y Gerente")}`,
  },
  {
    id: "21",
    nombre: "21. Borrar en biblioteca (grant delete + política for delete using (true))",
    sql: [
      `grant delete on public.biblioteca to authenticated`,
      `create policy "mutacion: borrar biblioteca" on public.biblioteca
         for delete to authenticated using (true)`,
    ],
    comprobar: `select has_table_privilege('authenticated', 'public.biblioteca', 'DELETE')
                   and exists (select 1 ${politicaDeBiblioteca("mutacion: borrar biblioteca")}) as ok`,
  },
  {
    id: "22",
    nombre: "22. Lectura de carpetas sin el filtro de organización",
    sql: `alter policy ${CARPETAS_LEER} on public.biblioteca_carpetas using (archivado_en is null or ${RAMA_DIRECTOR_O_GERENTE});`,
    comprobar: `select position('organizacion_actual_id' in qual) = 0 as ok ${politicaDeCarpetas("biblioteca_carpetas: leer las de mi organización")}`,
  },
  {
    id: "23",
    nombre: "23. Crear carpeta sin comprobar el rol",
    sql: `alter policy ${CARPETAS_CREAR} on public.biblioteca_carpetas
            with check (
              creado_por = (select privado.usuario_actual_id())
              and organizacion_id = (select privado.organizacion_actual_id())
            );`,
    comprobar: `select position('GERENTE' in with_check) = 0 as ok ${politicaDeCarpetas("biblioteca_carpetas: crear Director y Gerente")}`,
  },
  {
    id: "24",
    nombre: "24. Llave de biblioteca a carpetas sin la categoría (carpeta_id, organizacion_id)",
    sql: [
      `alter table public.biblioteca drop constraint biblioteca_carpeta_misma_seccion_y_organizacion`,
      `alter table public.biblioteca_carpetas add constraint mutacion_carpetas_id_organizacion_unico unique (id, organizacion_id)`,
      `alter table public.biblioteca add constraint mutacion_carpeta_sin_categoria
         foreign key (carpeta_id, organizacion_id)
         references public.biblioteca_carpetas (id, organizacion_id) on delete restrict`,
    ],
    comprobar: `select ${COLUMNAS_LLAVE_CARPETA} = array['carpeta_id', 'organizacion_id'] as ok`,
  },
];

// Estado normal esperado después de db:reset.
const COMPROBACIONES_FINALES = [
  {
    nombre: "1 política de lectura en cada tabla de organización y 3 en prospectos, biblioteca y biblioteca_carpetas (leer, crear, editar o archivar)",
    sql: `select count(*) = 12
                 and count(*) filter (where tablename not in ('prospectos', 'biblioteca', 'biblioteca_carpetas') and cmd = 'SELECT') = 3
                 and count(distinct tablename) filter (where tablename not in ('prospectos', 'biblioteca', 'biblioteca_carpetas')) = 3
                 and array_agg(cmd::text order by cmd::text) filter (where tablename = 'prospectos')
                     = array['INSERT', 'SELECT', 'UPDATE']
                 and array_agg(cmd::text order by cmd::text) filter (where tablename = 'biblioteca')
                     = array['INSERT', 'SELECT', 'UPDATE']
                 and array_agg(cmd::text order by cmd::text) filter (where tablename = 'biblioteca_carpetas')
                     = array['INSERT', 'SELECT', 'UPDATE']
                 and bool_and(roles = '{authenticated}') filter (where tablename = 'biblioteca_carpetas')
                 and bool_and(permissive = 'PERMISSIVE') as ok
          from pg_policies where schemaname = 'public'`,
  },
  {
    nombre: "authenticated solo tiene SELECT y anon nada en las tres tablas de organización",
    sql: `select bool_and(has_table_privilege('authenticated', t, 'SELECT'))
                 and not bool_or(has_table_privilege('authenticated', t, 'INSERT')
                              or has_table_privilege('authenticated', t, 'UPDATE')
                              or has_table_privilege('authenticated', t, 'DELETE'))
                 and not bool_or(has_table_privilege('anon', t, 'SELECT')) as ok
          from unnest(array['public.organizaciones', 'public.sucursales', 'public.usuarios']) t`,
  },
  {
    nombre: "prospectos: authenticated lee e inserta y edita solo las columnas permitidas, sin borrar; anon nada",
    sql: `select has_table_privilege('authenticated', 'public.prospectos', 'SELECT')
                 and not has_table_privilege('authenticated', 'public.prospectos', 'INSERT')
                 and not has_table_privilege('authenticated', 'public.prospectos', 'UPDATE')
                 and not has_table_privilege('authenticated', 'public.prospectos', 'DELETE')
                 and array_agg(a.attname::text order by a.attname)
                       filter (where has_column_privilege('authenticated', 'public.prospectos', a.attname, 'INSERT'))
                     = array['comentarios', 'contacto', 'estatus', 'nombre', 'seguimiento']
                 and array_agg(a.attname::text order by a.attname)
                       filter (where has_column_privilege('authenticated', 'public.prospectos', a.attname, 'UPDATE'))
                     = array['archivado_en', 'comentarios', 'contacto', 'estatus', 'nombre', 'seguimiento']
                 and not has_any_column_privilege('anon', 'public.prospectos', 'SELECT, INSERT, UPDATE')
                 and not has_table_privilege('anon', 'public.prospectos', 'DELETE') as ok
          from pg_attribute a
          where a.attrelid = 'public.prospectos'::regclass and a.attnum > 0 and not a.attisdropped`,
  },
  {
    nombre: "biblioteca: authenticated lee, inserta solo las columnas de contenido y carpeta_id y actualiza solo archivado_en y carpeta_id, sin borrar; anon nada",
    sql: `select has_table_privilege('authenticated', 'public.biblioteca', 'SELECT')
                 and not has_table_privilege('authenticated', 'public.biblioteca', 'INSERT')
                 and not has_table_privilege('authenticated', 'public.biblioteca', 'UPDATE')
                 and not has_table_privilege('authenticated', 'public.biblioteca', 'DELETE')
                 and array_agg(a.attname::text order by a.attname)
                       filter (where has_column_privilege('authenticated', 'public.biblioteca', a.attname, 'INSERT'))
                     = array['carpeta_id', 'categoria', 'descripcion', 'enlace', 'nombre', 'ruta', 'tamano_bytes', 'tipo', 'tipo_mime']
                 and array_agg(a.attname::text order by a.attname)
                       filter (where has_column_privilege('authenticated', 'public.biblioteca', a.attname, 'UPDATE'))
                     = array['archivado_en', 'carpeta_id']
                 and not has_any_column_privilege('anon', 'public.biblioteca', 'SELECT, INSERT, UPDATE')
                 and not has_table_privilege('anon', 'public.biblioteca', 'DELETE')
                 and (select relrowsecurity from pg_class where oid = 'public.biblioteca'::regclass) as ok
          from pg_attribute a
          where a.attrelid = 'public.biblioteca'::regclass and a.attnum > 0 and not a.attisdropped`,
  },
  {
    nombre: "biblioteca_carpetas: authenticated lee, inserta solo categoria y nombre y actualiza solo archivado_en, sin borrar; anon nada",
    sql: `select has_table_privilege('authenticated', 'public.biblioteca_carpetas', 'SELECT')
                 and not has_table_privilege('authenticated', 'public.biblioteca_carpetas', 'INSERT')
                 and not has_table_privilege('authenticated', 'public.biblioteca_carpetas', 'UPDATE')
                 and not has_table_privilege('authenticated', 'public.biblioteca_carpetas', 'DELETE')
                 and array_agg(a.attname::text order by a.attname)
                       filter (where has_column_privilege('authenticated', 'public.biblioteca_carpetas', a.attname, 'INSERT'))
                     = array['categoria', 'nombre']
                 and array_agg(a.attname::text order by a.attname)
                       filter (where has_column_privilege('authenticated', 'public.biblioteca_carpetas', a.attname, 'UPDATE'))
                     = array['archivado_en']
                 and not has_any_column_privilege('anon', 'public.biblioteca_carpetas', 'SELECT, INSERT, UPDATE')
                 and not has_table_privilege('anon', 'public.biblioteca_carpetas', 'DELETE')
                 and (select relrowsecurity from pg_class where oid = 'public.biblioteca_carpetas'::regclass) as ok
          from pg_attribute a
          where a.attrelid = 'public.biblioteca_carpetas'::regclass and a.attnum > 0 and not a.attisdropped`,
  },
  {
    nombre: "la llave de biblioteca a carpetas es compuesta (carpeta_id, categoria, organizacion_id) y el nombre es único entre las activas",
    sql: `select ${COLUMNAS_LLAVE_CARPETA} = array['carpeta_id', 'categoria', 'organizacion_id']
                 and (select count(*) = 1 from pg_constraint
                      where conrelid = 'public.biblioteca'::regclass and contype = 'f'
                        and confrelid = 'public.biblioteca_carpetas'::regclass
                        and conname = 'biblioteca_carpeta_misma_seccion_y_organizacion')
                 and (select array_agg(conname::text order by conname) from pg_constraint
                      where conrelid = 'public.biblioteca_carpetas'::regclass and contype = 'u')
                     = array['biblioteca_carpetas_id_categoria_organizacion_unico']
                 and (select indisunique and position('lower(nombre)' in pg_get_indexdef(indexrelid)) > 0
                             and position('archivado_en IS NULL' in pg_get_expr(indpred, indrelid)) > 0
                      from pg_index where indexrelid = 'public.biblioteca_carpetas_nombre_unico_activas'::regclass) as ok`,
  },
  {
    nombre: "bucket biblioteca privado, 26,214,400 bytes y 12 tipos; storage.objects solo con 2 políticas (leer y subir)",
    sql: `select (select count(*) = 1 from storage.buckets
                  where id = 'biblioteca' and not public and file_size_limit = 26214400
                    and cardinality(allowed_mime_types) = 12
                    and not ('text/html' = any (allowed_mime_types))
                    and not ('image/svg+xml' = any (allowed_mime_types)))
                 and (select array_agg(policyname::text || ':' || cmd::text order by policyname::text)
                      from pg_policies where schemaname = 'storage' and tablename = 'objects')
                     = array['biblioteca: leer objetos de mi organización:SELECT',
                             'biblioteca: subir objetos Director y Gerente:INSERT']
                 and (select bool_and(permissive = 'PERMISSIVE' and roles = '{authenticated}')
                      from pg_policies where schemaname = 'storage' and tablename = 'objects') as ok`,
  },
  {
    nombre: "las siete funciones de privado",
    sql: `select array_agg(p.proname::text order by p.proname)
                 = array['organizacion_actual_id', 'parece_dato_sensible', 'subordinados', 'sucursal_visible',
                         'usuario_actual', 'usuario_actual_id', 'usuarios_de_mi_organizacion'] as ok
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'privado'`,
  },
  {
    nombre: "las definiciones de privado, las funciones de trigger de la biblioteca y las políticas de prospectos, biblioteca, carpetas y el bucket son las originales",
    sql: `select position('u.activo' in ${definicion("privado.usuario_actual()")}) > 0
                 and position('s.organizacion_id = mia.organizacion_id' in ${definicion("privado.sucursal_visible(uuid)")}) > 0
                 and position('join abajo' in ${definicion("privado.subordinados(uuid)")}) > 0
                 and position('mia.organizacion_id' in ${definicion("privado.usuarios_de_mi_organizacion()")}) > 0
                 and position('CLABE' in ${definicion("privado.parece_dato_sensible(text)")}) > 0
                 and (select position('subordinados' in qual) > 0 and position('DIRECTOR_REGIONAL' in qual) > 0
                      ${politicaDeProspectos("prospectos: leer según rol y cadena de mando")})
                 and (select position('usuario_actual_id' in with_check) > 0
                      ${politicaDeProspectos("prospectos: crear los propios")})
                 and (select position('usuario_actual_id' in qual) > 0 and position('usuario_actual_id' in with_check) > 0
                      ${politicaDeProspectos("prospectos: editar los propios")})
                 and position('mia.organizacion_id' in ${definicion("privado.organizacion_actual_id()")}) > 0
                 and position('new.subido_por_nombre' in ${definicion("public.fijar_subido_por_nombre()")}) > 0
                 and (select prosecdef from pg_proc where oid = 'public.fijar_subido_por_nombre()'::regprocedure)
                 and not has_function_privilege('authenticated', 'public.fijar_subido_por_nombre()', 'EXECUTE')
                 and (select position('organizacion_actual_id' in qual) > 0 and position('GERENTE' in qual) > 0
                      ${politicaDeBiblioteca("biblioteca: leer los de mi organización")})
                 and (select position('usuario_actual_id' in with_check) > 0
                         and position('organizacion_actual_id' in with_check) > 0 and position('GERENTE' in with_check) > 0
                      ${politicaDeBiblioteca("biblioteca: crear Director y Gerente")})
                 and (select position('organizacion_actual_id' in qual) > 0 and position('GERENTE' in qual) > 0
                         and position('organizacion_actual_id' in with_check) > 0 and position('GERENTE' in with_check) > 0
                      ${politicaDeBiblioteca("biblioteca: archivar Director y Gerente")})
                 and (select position('organizacion_actual_id' in qual) > 0 and position('GERENTE' in qual) > 0
                         and position('biblioteca b' in qual) > 0
                      ${politicaDelBucket("biblioteca: leer objetos de mi organización")})
                 and (select position('organizacion_actual_id' in with_check) > 0 and position('GERENTE' in with_check) > 0
                      ${politicaDelBucket("biblioteca: subir objetos Director y Gerente")})
                 and (select position('organizacion_actual_id' in qual) > 0 and position('GERENTE' in qual) > 0
                      ${politicaDeCarpetas("biblioteca_carpetas: leer las de mi organización")})
                 and (select position('usuario_actual_id' in with_check) > 0
                         and position('organizacion_actual_id' in with_check) > 0 and position('GERENTE' in with_check) > 0
                      ${politicaDeCarpetas("biblioteca_carpetas: crear Director y Gerente")})
                 and (select position('organizacion_actual_id' in qual) > 0 and position('GERENTE' in qual) > 0
                         and position('organizacion_actual_id' in with_check) > 0 and position('GERENTE' in with_check) > 0
                      ${politicaDeCarpetas("biblioteca_carpetas: archivar Director y Gerente")})
                 and position('biblioteca_carpetas_sin_elementos_activos' in ${definicion("public.impedir_archivar_carpeta_con_elementos()")}) > 0
                 and position('for share' in ${definicion("public.exigir_carpeta_activa()")}) > 0
                 and position('c.organizacion_id = new.organizacion_id' in ${definicion("public.exigir_carpeta_activa()")}) > 0
                 and position('c.categoria = new.categoria' in ${definicion("public.exigir_carpeta_activa()")}) > 0
                 and position('biblioteca_restaurar_en_carpeta_archivada' in ${definicion("public.exigir_carpeta_activa()")}) > 0
                 and (select bool_and(prosecdef and proconfig = array['search_path=""'])
                      from pg_proc where oid in ('public.impedir_archivar_carpeta_con_elementos()'::regprocedure,
                                                 'public.exigir_carpeta_activa()'::regprocedure))
                 and not has_function_privilege('authenticated', 'public.impedir_archivar_carpeta_con_elementos()', 'EXECUTE')
                 and not has_function_privilege('authenticated', 'public.exigir_carpeta_activa()', 'EXECUTE')
                 and not has_function_privilege('anon', 'public.impedir_archivar_carpeta_con_elementos()', 'EXECUTE')
                 and not has_function_privilege('anon', 'public.exigir_carpeta_activa()', 'EXECUTE') as ok`,
  },
  {
    nombre: "los triggers",
    sql: `select array_agg(tgname::text order by tgname) = array[
                   'biblioteca_carpetas_fijar_archivado_en',
                   'biblioteca_carpetas_impedir_archivar_con_elementos',
                   'biblioteca_exigir_carpeta_activa',
                   'biblioteca_fijar_archivado_en',
                   'biblioteca_fijar_subido_por_nombre',
                   'organizaciones_fijar_actualizado_en',
                   'prospectos_fijar_actualizado_en',
                   'prospectos_fijar_archivado_en',
                   'prospectos_impedir_reasignar',
                   'sucursales_fijar_actualizado_en',
                   'sucursales_impedir_cambio_organizacion',
                   'usuarios_fijar_actualizado_en',
                   'usuarios_validar_cadena_de_mando'] as ok
          from pg_trigger
          where not tgisinternal
            and tgrelid in ('public.organizaciones'::regclass, 'public.sucursales'::regclass,
                            'public.usuarios'::regclass, 'public.prospectos'::regclass,
                            'public.biblioteca'::regclass, 'public.biblioteca_carpetas'::regclass)`,
  },
  {
    nombre: "las restricciones de prospectos",
    sql: `select array_agg(conname::text order by conname) = array[
                   'prospectos_comentarios_largo_maximo',
                   'prospectos_contacto_10_digitos',
                   'prospectos_nombre_largo_maximo',
                   'prospectos_nombre_no_vacio',
                   'prospectos_sin_datos_sensibles'] as ok
          from pg_constraint
          where conrelid = 'public.prospectos'::regclass and contype = 'c'`,
  },
  {
    nombre: "las restricciones de biblioteca",
    sql: `select array_agg(conname::text order by conname) = array[
                   'biblioteca_coherencia_tipo',
                   'biblioteca_descripcion_largo_maximo',
                   'biblioteca_enlace_https',
                   'biblioteca_nombre_largo_maximo',
                   'biblioteca_nombre_no_vacio',
                   'biblioteca_ruta_de_su_organizacion',
                   'biblioteca_ruta_formato',
                   'biblioteca_sin_datos_sensibles',
                   'biblioteca_tamano_maximo',
                   'biblioteca_tipo_mime_permitido'] as ok
          from pg_constraint
          where conrelid = 'public.biblioteca'::regclass and contype = 'c'`,
  },
  {
    nombre: "las restricciones de biblioteca_carpetas",
    sql: `select array_agg(conname::text order by conname) = array[
                   'biblioteca_carpetas_nombre_largo_maximo',
                   'biblioteca_carpetas_nombre_no_vacio',
                   'biblioteca_carpetas_nombre_sin_espacios_extremos',
                   'biblioteca_carpetas_nombre_sin_invisibles',
                   'biblioteca_carpetas_sin_datos_sensibles'] as ok
          from pg_constraint
          where conrelid = 'public.biblioteca_carpetas'::regclass and contype = 'c'`,
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

// Una mutación cuenta como MATADA solo si fallaron pruebas con nombre. En
// Windows, un worker de Vitest a veces se cae al arrancar un archivo (código
// 3221226505, 0xC0000409); esa caída no es una prueba que falló. Si la corrida
// sale con error y sin pruebas con nombre fallidas, se repite hasta 2 veces; si
// persiste, la mutación queda INCONCLUSA.
const REPETICIONES_MAXIMAS = 2;

async function correrPruebas() {
  for (let repeticiones = 0; ; repeticiones++) {
    const { conNombre, otras, codigo } = await correrPruebasUnaVez();
    if (conNombre.length > 0) return { estado: "MATADA", fallidas: conNombre, repeticiones };
    if (codigo === 0) return { estado: "SOBREVIVIÓ", fallidas: [], repeticiones };
    if (repeticiones === REPETICIONES_MAXIMAS) return { estado: "INCONCLUSA", fallidas: otras, repeticiones };
    console.log(
      `  npm run test:rls salió con código ${codigo} sin pruebas con nombre fallidas ` +
        `(${otras.join("; ")}); repetición ${repeticiones + 1} de ${REPETICIONES_MAXIMAS}…`,
    );
  }
}

async function correrPruebasUnaVez() {
  const reporte = join(temporal, "reporte.json");
  rmSync(reporte, { force: true });
  const { codigo, salida } = await correr(`npm run test:rls -- --reporter=json --outputFile="${reporte}"`);
  let conNombre = [];
  const otras = [];
  try {
    const json = JSON.parse(readFileSync(reporte, "utf8"));
    conNombre = json.testResults.flatMap((archivo) =>
      archivo.assertionResults.filter((p) => p.status === "failed").map((p) => p.fullName),
    );
    // Archivos que fallaron sin pruebas individuales (p. ej. en un beforeAll).
    for (const archivo of json.testResults) {
      if (archivo.status === "failed" && !archivo.assertionResults.some((p) => p.status === "failed")) {
        otras.push(`(archivo ${archivo.name.split(/[\\/]/).pop()}: ${archivo.message || "falló"})`);
      }
    }
  } catch {
    otras.push(`(sin reporte; código ${codigo}: ${salida.trim().split("\n").slice(-3).join(" ")})`);
  }
  if (/Worker exited unexpectedly/.test(salida)) otras.push("(se cayó un worker de Vitest)");
  if (codigo !== 0 && otras.length === 0 && conNombre.length === 0) otras.push(`(código ${codigo})`);
  return { conNombre, otras, codigo };
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
  const resultado = { nombre: m.nombre, estado: "ERROR", fallidas: [], repeticiones: 0 };
  try {
    // La CLI no acepta varias sentencias en una consulta: van una por una.
    for (const [j, sentencia] of [m.sql].flat().entries()) await consultar(sentencia, `mutacion-${m.id}-${j + 1}`);
    if (!(await comprobar(m.comprobar, `comprobar-${m.id}`))) {
      throw new Error("la consulta de comprobación dice que la mutación no quedó aplicada");
    }
    console.log("  aplicada y comprobada; corriendo npm run test:rls…");
    Object.assign(resultado, await correrPruebas());
  } catch (e) {
    resultado.fallidas = [`(error: ${e.message})`];
  }

  // De inmediato: a la consola y al log.
  console.log(
    `  ${resultado.estado} (${resultado.fallidas.length} pruebas fallaron; ${resultado.repeticiones} repeticiones)`,
  );
  for (const f of resultado.fallidas) console.log(`    - ${f}`);
  anotar(
    `\n### ${m.nombre}\n\n**${resultado.estado}** — ${resultado.fallidas.length} pruebas fallaron` +
      ` (${resultado.repeticiones} repeticiones por caída de Vitest)\n\n` +
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

console.log("\n| Mutación | Resultado | Repeticiones | Pruebas que fallaron |");
console.log("|---|---|---|---|");
for (const r of resultados) {
  const lista = r.fallidas.length > 0 ? `${r.fallidas.length}: ${r.fallidas.join("<br>")}` : "ninguna";
  console.log(`| ${r.nombre} | ${r.estado} | ${r.repeticiones} | ${lista} |`);
}

console.log("\n| Estado final | Resultado |");
console.log("|---|---|");
for (const f of finales) console.log(`| ${f.nombre} | ${f.ok ? "OK" : "FALLA"} |`);

anotar(
  `\n**Estado final:** ${finales.every((f) => f.ok) ? "normal" : "ANORMAL"} ` +
    `(${finales.map((f) => `${f.nombre}: ${f.ok ? "OK" : "FALLA"}`).join("; ")})\n`,
);

const hayErrores =
  resultados.some((r) => r.estado === "ERROR" || r.estado === "INCONCLUSA") || !finales.every((f) => f.ok);
const sobrevivio = resultados.some((r) => r.estado === "SOBREVIVIÓ");
process.exit(hayErrores ? 1 : sobrevivio ? 2 : 0);
