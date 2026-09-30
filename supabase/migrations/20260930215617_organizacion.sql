-- =============================================================================
-- Migración: organizacion
-- Estructura base de la organización: organizaciones, sucursales y usuarios.
-- Cadena de pertenencia: usuario -> sucursal -> organización.
-- RLS activado sin políticas: todo acceso vía Data API queda denegado por ahora.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tipo de rol
-- -----------------------------------------------------------------------------
create type public.rol_usuario as enum (
  'DIRECTOR_REGIONAL',
  'GERENTE',
  'EJECUTIVO'
);


-- -----------------------------------------------------------------------------
-- 2. Tablas
-- -----------------------------------------------------------------------------
create table public.organizaciones (
  id             uuid        primary key default gen_random_uuid(),
  nombre         text        not null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por     uuid,
  constraint organizaciones_nombre_no_vacio check (btrim(nombre) <> '')
);

create table public.sucursales (
  id              uuid        primary key default gen_random_uuid(),
  organizacion_id uuid        not null
                              references public.organizaciones (id) on delete restrict,
  nombre          text        not null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  creado_por      uuid,
  constraint sucursales_nombre_no_vacio check (btrim(nombre) <> '')
);

create table public.usuarios (
  id             uuid        primary key default gen_random_uuid(),
  auth_id        uuid        not null unique
                             references auth.users (id) on delete restrict,
  nombre         text        not null,
  rol            public.rol_usuario not null,
  sucursal_id    uuid        not null
                             references public.sucursales (id) on delete restrict,
  jefe_id        uuid
                             references public.usuarios (id) on delete restrict,
  nivel_comision text,
  activo         boolean     not null default true,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  creado_por     uuid,
  constraint usuarios_nombre_no_vacio check (btrim(nombre) <> ''),
  constraint usuarios_nivel_comision_valido
    check (nivel_comision is null or nivel_comision in ('N1', 'N2', 'N3'))
);

-- creado_por apunta a usuarios; se agrega después porque organizaciones y
-- sucursales se crean antes que usuarios.
alter table public.organizaciones
  add constraint organizaciones_creado_por_fkey
  foreign key (creado_por) references public.usuarios (id) on delete restrict;

alter table public.sucursales
  add constraint sucursales_creado_por_fkey
  foreign key (creado_por) references public.usuarios (id) on delete restrict;

alter table public.usuarios
  add constraint usuarios_creado_por_fkey
  foreign key (creado_por) references public.usuarios (id) on delete restrict;


-- -----------------------------------------------------------------------------
-- 3. Índices
-- auth_id ya tiene índice por su restricción UNIQUE.
-- sucursales.organizacion_id ya queda cubierto por el índice único de nombre,
-- que empieza por esa columna.
-- Los nombres se comparan sin distinguir mayúsculas ni espacios en los extremos.
-- -----------------------------------------------------------------------------
create unique index organizaciones_nombre_unico
  on public.organizaciones (lower(btrim(nombre)));

create unique index sucursales_organizacion_nombre_unico
  on public.sucursales (organizacion_id, lower(btrim(nombre)));

create index usuarios_jefe_id_idx     on public.usuarios (jefe_id);
create index usuarios_sucursal_id_idx on public.usuarios (sucursal_id);


-- -----------------------------------------------------------------------------
-- 4. Trigger: actualizado_en
-- -----------------------------------------------------------------------------
create function public.fijar_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger organizaciones_fijar_actualizado_en
  before update on public.organizaciones
  for each row execute function public.fijar_actualizado_en();

create trigger sucursales_fijar_actualizado_en
  before update on public.sucursales
  for each row execute function public.fijar_actualizado_en();

create trigger usuarios_fijar_actualizado_en
  before update on public.usuarios
  for each row execute function public.fijar_actualizado_en();


-- -----------------------------------------------------------------------------
-- 5. Trigger: cadena de mando válida
-- Sin autojefe, sin ciclos, jefe de la misma organización y sin cambiar a un
-- usuario a una sucursal de otra organización.
-- -----------------------------------------------------------------------------
create function public.validar_cadena_de_mando()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  org_usuario  uuid;
  org_anterior uuid;
  org_jefe     uuid;
  hay_ciclo    boolean;
begin
  -- Organización de la sucursal del usuario. Si la sucursal no existe,
  -- queda nula y la llave foránea reporta el error.
  select s.organizacion_id
  into org_usuario
  from public.sucursales s
  where s.id = new.sucursal_id;

  if tg_op = 'UPDATE' and new.sucursal_id is distinct from old.sucursal_id then
    select s.organizacion_id
    into org_anterior
    from public.sucursales s
    where s.id = old.sucursal_id;

    if org_usuario is distinct from org_anterior then
      raise exception 'No se puede mover al usuario a una sucursal de otra organización.'
        using errcode = 'check_violation',
              detail = 'La sucursal nueva pertenece a una organización distinta de la actual del usuario.',
              hint = 'Elige una sucursal de la misma organización o da de alta al usuario en la otra organización.';
    end if;
  end if;

  if new.jefe_id is null then
    return new;
  end if;

  if new.jefe_id = new.id then
    raise exception 'Un usuario no puede ser su propio jefe.'
      using errcode = 'check_violation',
            hint = 'Elige como jefe a otra persona o deja el campo de jefe vacío.';
  end if;

  -- Organización del jefe. Si el jefe no existe, queda nula y la llave
  -- foránea reporta el error.
  select s.organizacion_id
  into org_jefe
  from public.usuarios u
  join public.sucursales s on s.id = u.sucursal_id
  where u.id = new.jefe_id;

  if org_jefe is not null and org_usuario is not null and org_jefe <> org_usuario then
    raise exception 'No se puede asignar ese jefe: pertenece a otra organización.'
      using errcode = 'check_violation',
            detail = 'La sucursal del jefe elegido es de una organización distinta de la del usuario.',
            hint = 'Elige como jefe a alguien de una sucursal de la misma organización.';
  end if;

  -- Serializa los cambios de jefe para que dos cambios simultáneos
  -- no puedan formar un ciclo entre ambos.
  perform pg_advisory_xact_lock(hashtext('public.usuarios.jefe_id'));

  -- Sube por la cadena desde el nuevo jefe; si llega a este usuario, hay ciclo.
  with recursive superiores (id) as (
    select u.jefe_id
    from public.usuarios u
    where u.id = new.jefe_id
    union
    select u.jefe_id
    from public.usuarios u
    join superiores s on u.id = s.id
  )
  select exists (select 1 from superiores where id = new.id)
  into hay_ciclo;

  if hay_ciclo then
    raise exception 'No se puede asignar ese jefe: formaría un ciclo en la cadena de mando.'
      using errcode = 'check_violation',
            detail = 'El jefe elegido depende, directa o indirectamente, de este mismo usuario.',
            hint = 'Elige como jefe a alguien que esté por encima de este usuario, no por debajo.';
  end if;

  return new;
end;
$$;

create trigger usuarios_validar_cadena_de_mando
  before insert or update of jefe_id, sucursal_id on public.usuarios
  for each row execute function public.validar_cadena_de_mando();


-- -----------------------------------------------------------------------------
-- 5b. Trigger: la organización de una sucursal no cambia después de crearla
-- -----------------------------------------------------------------------------
create function public.impedir_cambio_organizacion_sucursal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organizacion_id is distinct from old.organizacion_id then
    raise exception 'No se puede cambiar la organización de una sucursal.'
      using errcode = 'check_violation',
            detail = 'La sucursal ya pertenece a una organización y sus usuarios dependen de ella.',
            hint = 'Si la sucursal debe estar en otra organización, crea una sucursal nueva en esa organización.';
  end if;

  return new;
end;
$$;

create trigger sucursales_impedir_cambio_organizacion
  before update of organizacion_id on public.sucursales
  for each row execute function public.impedir_cambio_organizacion_sucursal();

revoke execute on function public.impedir_cambio_organizacion_sucursal() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 6. Seguridad: RLS sin políticas y sin permisos para anon/authenticated
-- -----------------------------------------------------------------------------
alter table public.organizaciones enable row level security;
alter table public.sucursales     enable row level security;
alter table public.usuarios       enable row level security;

revoke all on table public.organizaciones from anon, authenticated;
revoke all on table public.sucursales     from anon, authenticated;
revoke all on table public.usuarios       from anon, authenticated;

-- Las funciones de trigger no deben invocarse directamente.
revoke execute on function public.fijar_actualizado_en()    from public, anon, authenticated;
revoke execute on function public.validar_cadena_de_mando() from public, anon, authenticated;
