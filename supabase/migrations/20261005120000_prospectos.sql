-- =============================================================================
-- Migración: prospectos
-- Pipeline de prospectos con seguridad por fila.
--   Leer: el dueño, sus superiores (gerentes) por la cadena de mando y los
--         directores de su organización.
--   Crear: solo a nombre propio (ejecutivo_id lo pone la base).
--   Editar: solo el dueño; nadie reasigna; nadie borra (se archiva).
-- La app no guarda datos sensibles: una restricción rechaza lo que parezca
-- CLABE, RFC o CURP (la app avisa antes con un mensaje claro).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tipo de estatus (texto exacto; el Excel muestra "NO INTERESADO")
-- -----------------------------------------------------------------------------
create type public.estatus_prospecto as enum (
  'INTERESADO',
  'INTERMITENTE',
  'NO_INTERESADO'
);


-- -----------------------------------------------------------------------------
-- 2. Funciones auxiliares en el esquema privado
-- -----------------------------------------------------------------------------

-- Id del usuario logueado y activo, o null. Escalar para poder usarse como
-- valor por omisión y compararse en las políticas. No necesita security
-- definer: solo llama a usuario_actual(), que ya lo es.
create function privado.usuario_actual_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select yo.id from privado.usuario_actual() yo;
$$;

-- Ids de todos los usuarios (activos o no) de la organización del usuario
-- actual. Si no hay usuario activo, no devuelve nada.
create function privado.usuarios_de_mi_organizacion()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from privado.usuario_actual() yo
  join public.sucursales mia on mia.id = yo.sucursal_id
  join public.sucursales s on s.organizacion_id = mia.organizacion_id
  join public.usuarios u on u.sucursal_id = s.id;
$$;

-- ¿El texto parece un dato sensible? Devuelve 'CLABE', 'CURP', 'RFC' o null.
--   CLABE: exactamente 18 dígitos, seguidos o separados por un espacio o un
--          guion, sin más dígitos pegados antes ni después.
--   CURP:  4 letras, fecha AAMMDD, sexo, entidad, 3 consonantes, 2 caracteres.
--   RFC:   3 o 4 letras, fecha AAMMDD y homoclave de 3 caracteres.
--   CURP y RFC van anclados a límites de palabra (\m y \M), para que un
--   correo como prospecto900101abc@ejemplo.test no se marque.
-- Sin distinguir mayúsculas. Se usa en una restricción, por eso es immutable.
create function privado.parece_dato_sensible(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from regexp_matches(p_texto, '[0-9]+(?:[ -][0-9]+)*', 'g') as m (grupo)
      where length(regexp_replace(m.grupo[1], '[^0-9]', '', 'g')) = 18
    ) then 'CLABE'
    when p_texto ~* '\m[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HM][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]\M'
      then 'CURP'
    when p_texto ~* '\m[A-ZÑ&]{3,4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{3}\M'
      then 'RFC'
  end;
$$;

revoke execute on function privado.usuario_actual_id()            from public, anon;
revoke execute on function privado.usuarios_de_mi_organizacion()  from public, anon;
revoke execute on function privado.parece_dato_sensible(text)     from public, anon;

grant execute on function privado.usuario_actual_id()             to authenticated;
grant execute on function privado.usuarios_de_mi_organizacion()   to authenticated;
-- La restricción se evalúa con los permisos de quien escribe: la app
-- (authenticated) y el administrador (service_role).
grant execute on function privado.parece_dato_sensible(text)      to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 3. Tabla
-- -----------------------------------------------------------------------------
create table public.prospectos (
  id             uuid        primary key default gen_random_uuid(),
  ejecutivo_id   uuid        not null default privado.usuario_actual_id()
                             references public.usuarios (id) on delete restrict,
  nombre         text        not null,
  contacto       text        not null,
  comentarios    text        not null default '',
  estatus        public.estatus_prospecto not null,
  seguimiento    date,
  archivado_en   timestamptz,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint prospectos_nombre_no_vacio
    check (btrim(nombre) <> ''),
  constraint prospectos_nombre_largo_maximo
    check (char_length(nombre) <= 150),
  -- [0-9] y no \d, para no aceptar dígitos Unicode de otros sistemas.
  constraint prospectos_contacto_10_digitos
    check (contacto ~ '^[0-9]{10}$'),
  constraint prospectos_comentarios_largo_maximo
    check (char_length(comentarios) <= 1000),
  constraint prospectos_sin_datos_sensibles
    check (privado.parece_dato_sensible(nombre || ' ' || comentarios) is null)
);

comment on column public.prospectos.archivado_en is
  'Nulo = activo. La hora la pone el servidor al archivar.';

-- Sirve a la llave foránea, a las políticas y a la agenda de seguimientos.
create index prospectos_ejecutivo_seguimiento_idx
  on public.prospectos (ejecutivo_id, seguimiento);


-- -----------------------------------------------------------------------------
-- 4. Triggers
-- -----------------------------------------------------------------------------
create trigger prospectos_fijar_actualizado_en
  before update on public.prospectos
  for each row execute function public.fijar_actualizado_en();

-- Nadie cambia el ejecutivo de un prospecto, ni el administrador.
create function public.impedir_reasignar_prospecto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ejecutivo_id is distinct from old.ejecutivo_id then
    raise exception 'No se puede cambiar el ejecutivo de un prospecto.'
      using errcode = 'check_violation',
            detail = 'Cada prospecto pertenece al ejecutivo que lo registró.',
            hint = 'Si otro ejecutivo debe atenderlo, que registre su propio prospecto.';
  end if;
  return new;
end;
$$;

create trigger prospectos_impedir_reasignar
  before update of ejecutivo_id on public.prospectos
  for each row execute function public.impedir_reasignar_prospecto();

-- Al archivar, la hora la pone el servidor, sin importar lo que mande el
-- cliente. Restaurar (volver a null) se permite.
create function public.fijar_archivado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archivado_en is not null
     and new.archivado_en is distinct from old.archivado_en then
    new.archivado_en := now();
  end if;
  return new;
end;
$$;

create trigger prospectos_fijar_archivado_en
  before update of archivado_en on public.prospectos
  for each row execute function public.fijar_archivado_en();

revoke execute on function public.impedir_reasignar_prospecto() from public, anon, authenticated;
revoke execute on function public.fijar_archivado_en()          from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. Seguridad: RLS y permisos mínimos
-- Supabase da todos los permisos a anon y authenticated en cada tabla nueva:
-- se quitan y se dan solo los necesarios, columna por columna.
-- ejecutivo_id, creado_en y actualizado_en los pone la base.
-- Sin DELETE: nadie borra, se archiva.
-- -----------------------------------------------------------------------------
alter table public.prospectos enable row level security;

revoke all on table public.prospectos from anon, authenticated;

grant select on table public.prospectos to authenticated;
grant insert (nombre, contacto, comentarios, estatus, seguimiento)
  on table public.prospectos to authenticated;
grant update (nombre, contacto, comentarios, estatus, seguimiento, archivado_en)
  on table public.prospectos to authenticated;


-- -----------------------------------------------------------------------------
-- 6. Políticas
-- Un usuario inactivo no obtiene fila de usuario_actual(): no lee ni escribe.
-- -----------------------------------------------------------------------------

-- Mismo criterio que la política de usuarios: un jefe nunca ve el prospecto de
-- alguien cuya fila de usuario no ve.
create policy "prospectos: leer según rol y cadena de mando"
  on public.prospectos
  for select
  to authenticated
  using (
    ejecutivo_id = (select privado.usuario_actual_id())
    or ejecutivo_id in (
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
      and ejecutivo_id in (select privado.usuarios_de_mi_organizacion())
    )
  );

create policy "prospectos: crear los propios"
  on public.prospectos
  for insert
  to authenticated
  with check ( ejecutivo_id = (select privado.usuario_actual_id()) );

create policy "prospectos: editar los propios"
  on public.prospectos
  for update
  to authenticated
  using      ( ejecutivo_id = (select privado.usuario_actual_id()) )
  with check ( ejecutivo_id = (select privado.usuario_actual_id()) );
