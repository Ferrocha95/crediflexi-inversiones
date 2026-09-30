-- =============================================================================
-- Migración: organizacion_rls
-- Lectura con RLS para organizaciones, sucursales y usuarios.
-- Las funciones auxiliares viven en el esquema "privado", que la Data API no
-- expone, y leen las tablas como su dueño para evitar la recursión de RLS.
-- Solo lectura: no hay políticas ni permisos de escritura para authenticated.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Esquema privado
-- No está en [api].schemas de config.toml, así que no tiene endpoints.
-- -----------------------------------------------------------------------------
create schema privado;

revoke all on schema privado from public;


-- -----------------------------------------------------------------------------
-- 2. Funciones auxiliares (security definer)
-- -----------------------------------------------------------------------------

-- Fila del usuario logueado, solo si está activo. Si no hay sesión, no tiene
-- fila en usuarios o está inactivo, no devuelve nada.
create function privado.usuario_actual()
returns setof public.usuarios
language sql
stable
security definer
set search_path = ''
rows 1
as $$
  select u.*
  from public.usuarios u
  where u.auth_id = (select auth.uid())
    and u.activo;
$$;

-- Ids de todos los usuarios debajo de p_jefe en la cadena de mando (sin incluir
-- a p_jefe), limitados a la organización de p_jefe. Recorre también a los
-- inactivos para no cortar la cadena. Solo responde si quien consulta está
-- activo y es de la misma organización que p_jefe.
create function privado.subordinados(p_jefe uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive
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
    union
    select u.id
    from public.usuarios u
    join abajo a on u.jefe_id = a.id
    join public.sucursales s on s.id = u.sucursal_id
    join org_jefe o on o.organizacion_id = s.organizacion_id
  )
  select a.id
  from abajo a
  where exists (
    select 1
    from privado.usuario_actual() yo
    join public.sucursales mia on mia.id = yo.sucursal_id
    join org_jefe o on o.organizacion_id = mia.organizacion_id
  );
$$;

-- ¿Puede el usuario actual ver la sucursal p_sucursal?
--   Director regional: todas las de su organización.
--   Gerente: la suya y las de sus subordinados.
--   Ejecutivo: solo la suya.
create function privado.sucursal_visible(p_sucursal uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from privado.usuario_actual() yo
    join public.sucursales mia on mia.id = yo.sucursal_id
    join public.sucursales s on s.id = p_sucursal
    where s.id = yo.sucursal_id
       or (yo.rol = 'DIRECTOR_REGIONAL'
           and s.organizacion_id = mia.organizacion_id)
       or (yo.rol = 'GERENTE'
           and exists (
             select 1
             from public.usuarios sub
             where sub.id in (select privado.subordinados(yo.id))
               and sub.sucursal_id = s.id
           ))
  );
$$;


-- -----------------------------------------------------------------------------
-- 3. Permisos sobre el esquema privado y sus funciones
-- Las políticas se evalúan con los permisos de quien consulta, así que
-- authenticated necesita usage del esquema y execute de las funciones.
-- -----------------------------------------------------------------------------
revoke execute on function privado.usuario_actual()          from public, anon;
revoke execute on function privado.subordinados(uuid)        from public, anon;
revoke execute on function privado.sucursal_visible(uuid)    from public, anon;

grant usage on schema privado to authenticated;

grant execute on function privado.usuario_actual()           to authenticated;
grant execute on function privado.subordinados(uuid)         to authenticated;
grant execute on function privado.sucursal_visible(uuid)     to authenticated;


-- -----------------------------------------------------------------------------
-- 4. Políticas de lectura
-- Un usuario inactivo no obtiene fila de usuario_actual(), así que ninguna
-- condición se cumple y no ve nada.
-- -----------------------------------------------------------------------------

-- organizaciones: solo la propia.
create policy "organizaciones: leer la propia"
  on public.organizaciones
  for select
  to authenticated
  using (
    id in (
      select mia.organizacion_id
      from privado.usuario_actual() yo
      join public.sucursales mia on mia.id = yo.sucursal_id
    )
  );

-- sucursales: según rol, vía privado.sucursal_visible.
create policy "sucursales: leer las visibles según rol"
  on public.sucursales
  for select
  to authenticated
  using ( privado.sucursal_visible(id) );

-- usuarios: él mismo; el gerente, además sus subordinados; el director, toda
-- su organización. La política nunca consulta public.usuarios directamente:
-- todo pasa por funciones security definer, así que no hay recursión.
create policy "usuarios: leer según rol y cadena de mando"
  on public.usuarios
  for select
  to authenticated
  using (
    id in (
      select yo.id
      from privado.usuario_actual() yo
    )
    or id in (
      select privado.subordinados(yo.id)
      from privado.usuario_actual() yo
      where yo.rol = 'GERENTE'
    )
    or (
      exists (
        select 1
        from privado.usuario_actual() yo
        where yo.rol = 'DIRECTOR_REGIONAL'
      )
      and privado.sucursal_visible(sucursal_id)
    )
  );


-- -----------------------------------------------------------------------------
-- 5. Permisos de tabla: solo lectura para authenticated, nada para anon
-- -----------------------------------------------------------------------------
grant select on table public.organizaciones to authenticated;
grant select on table public.sucursales     to authenticated;
grant select on table public.usuarios       to authenticated;
