-- =============================================================================
-- Migración: biblioteca
-- Material de consulta de la organización: archivos (en un bucket privado de
-- Storage) y enlaces https, en 4 categorías fijas.
--   Leer: usuarios activos de la misma organización; lo archivado, solo
--         Director regional y Gerente.
--   Crear: solo Director regional y Gerente, a su nombre y en su organización
--          (organizacion_id y subido_por los pone la base).
--   Archivar: solo Director regional y Gerente de la organización; solo la
--             columna archivado_en. Nadie borra.
-- El bucket "biblioteca" repite las reglas: ruta organización/uuid.ext; leer,
-- la organización (un ejecutivo, solo si la fila le es visible); subir,
-- Director y Gerente; sin actualizar ni borrar.
-- La app no guarda datos sensibles: la misma restricción que en prospectos.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tipos
-- -----------------------------------------------------------------------------
create type public.categoria_biblioteca as enum (
  'HERRAMIENTAS',
  'MULTIMEDIA',
  'EMPRESA',
  'CAPACITACION'
);

create type public.tipo_biblioteca as enum (
  'ARCHIVO',
  'ENLACE'
);


-- -----------------------------------------------------------------------------
-- 2. Función auxiliar en el esquema privado
-- -----------------------------------------------------------------------------

-- Organización del usuario logueado y activo, o null. security definer para
-- leer su sucursal sin depender de la política de sucursales.
create function privado.organizacion_actual_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select mia.organizacion_id
  from privado.usuario_actual() yo
  join public.sucursales mia on mia.id = yo.sucursal_id;
$$;

revoke execute on function privado.organizacion_actual_id() from public, anon;
grant execute on function privado.organizacion_actual_id() to authenticated;


-- -----------------------------------------------------------------------------
-- 3. Tabla
-- -----------------------------------------------------------------------------
create table public.biblioteca (
  id              uuid        primary key default gen_random_uuid(),
  organizacion_id uuid        not null default privado.organizacion_actual_id()
                              references public.organizaciones (id) on delete restrict,
  categoria       public.categoria_biblioteca not null,
  nombre          text        not null,
  descripcion     text        not null default '',
  tipo            public.tipo_biblioteca not null,
  enlace          text,
  ruta            text        unique,
  tipo_mime       text,
  tamano_bytes    bigint,
  subido_por      uuid        not null default privado.usuario_actual_id()
                              references public.usuarios (id) on delete restrict,
  creado_en       timestamptz not null default now(),
  archivado_en    timestamptz,
  constraint biblioteca_nombre_no_vacio
    check (btrim(nombre) <> ''),
  constraint biblioteca_nombre_largo_maximo
    check (char_length(nombre) <= 150),
  constraint biblioteca_descripcion_largo_maximo
    check (char_length(descripcion) <= 500),
  -- Solo https, sin usuario ni contraseña (el host no admite @), sin espacios
  -- ni caracteres de control.
  constraint biblioteca_enlace_https
    check (
      enlace is null
      or (
        char_length(enlace) <= 500
        and enlace ~ '^https://[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$'
      )
    ),
  -- Nombre generado: organización/uuid.extensión, con una extensión permitida.
  constraint biblioteca_ruta_formato
    check (
      ruta is null
      or ruta ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|webp|gif|mp4|webm|docx|xlsx|pptx|txt|csv)$'
    ),
  constraint biblioteca_ruta_de_su_organizacion
    check (ruta is null or split_part(ruta, '/', 1) = organizacion_id::text),
  constraint biblioteca_tipo_mime_permitido
    check (
      tipo_mime is null
      or tipo_mime in (
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
        'video/mp4',
        'video/webm',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv'
      )
    ),
  constraint biblioteca_tamano_maximo
    check (tamano_bytes is null or tamano_bytes between 1 and 26214400),
  -- Un archivo exige ruta, tipo y tamaño (sin enlace); un enlace exige URL
  -- (sin ruta, tipo ni tamaño).
  constraint biblioteca_coherencia_tipo
    check (
      (tipo = 'ARCHIVO' and ruta is not null and tipo_mime is not null and tamano_bytes is not null and enlace is null)
      or (tipo = 'ENLACE' and enlace is not null and ruta is null and tipo_mime is null and tamano_bytes is null)
    ),
  constraint biblioteca_sin_datos_sensibles
    check (privado.parece_dato_sensible(nombre || ' ' || descripcion) is null)
);

comment on column public.biblioteca.archivado_en is
  'Nulo = activo. La hora la pone el servidor al archivar.';
comment on column public.biblioteca.ruta is
  'Objeto en el bucket biblioteca: organizacion_id/uuid.extension.';

-- Sirve a la llave foránea y a las políticas (todas filtran por organización).
create index biblioteca_organizacion_categoria_idx
  on public.biblioteca (organizacion_id, categoria);

create index biblioteca_subido_por_idx
  on public.biblioteca (subido_por);


-- -----------------------------------------------------------------------------
-- 4. Trigger: al archivar, la hora la pone el servidor (misma función que
--    prospectos).
-- -----------------------------------------------------------------------------
create trigger biblioteca_fijar_archivado_en
  before update of archivado_en on public.biblioteca
  for each row execute function public.fijar_archivado_en();


-- -----------------------------------------------------------------------------
-- 5. Seguridad: RLS y permisos mínimos, columna por columna.
-- organizacion_id, subido_por, creado_en y archivado_en (al crear) los pone la
-- base. Sin DELETE: nadie borra, se archiva.
-- -----------------------------------------------------------------------------
alter table public.biblioteca enable row level security;

revoke all on table public.biblioteca from anon, authenticated;

grant select on table public.biblioteca to authenticated;
grant insert (categoria, nombre, descripcion, tipo, enlace, ruta, tipo_mime, tamano_bytes)
  on table public.biblioteca to authenticated;
grant update (archivado_en)
  on table public.biblioteca to authenticated;


-- -----------------------------------------------------------------------------
-- 6. Políticas de la tabla
-- Un usuario inactivo no obtiene fila de usuario_actual() ni organización:
-- no lee ni escribe.
-- -----------------------------------------------------------------------------
create policy "biblioteca: leer los de mi organización"
  on public.biblioteca
  for select
  to authenticated
  using (
    organizacion_id = (select privado.organizacion_actual_id())
    and (
      archivado_en is null
      or exists (
        select 1
        from privado.usuario_actual() yo
        where yo.rol in ('DIRECTOR_REGIONAL', 'GERENTE')
      )
    )
  );

create policy "biblioteca: crear Director y Gerente"
  on public.biblioteca
  for insert
  to authenticated
  with check (
    subido_por = (select privado.usuario_actual_id())
    and organizacion_id = (select privado.organizacion_actual_id())
    and exists (
      select 1
      from privado.usuario_actual() yo
      where yo.rol in ('DIRECTOR_REGIONAL', 'GERENTE')
    )
  );

create policy "biblioteca: archivar Director y Gerente"
  on public.biblioteca
  for update
  to authenticated
  using (
    organizacion_id = (select privado.organizacion_actual_id())
    and exists (
      select 1
      from privado.usuario_actual() yo
      where yo.rol in ('DIRECTOR_REGIONAL', 'GERENTE')
    )
  )
  with check (
    organizacion_id = (select privado.organizacion_actual_id())
    and exists (
      select 1
      from privado.usuario_actual() yo
      where yo.rol in ('DIRECTOR_REGIONAL', 'GERENTE')
    )
  );


-- -----------------------------------------------------------------------------
-- 7. Bucket privado de Storage
-- 25 MiB (26,214,400 bytes) y solo los tipos permitidos. El límite global de
-- supabase/config.toml ([storage] file_size_limit = "50MiB") es mayor.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'biblioteca',
  'biblioteca',
  false,
  26214400,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv'
  ]
);


-- -----------------------------------------------------------------------------
-- 8. Políticas del bucket (storage.objects)
-- Sin políticas de update ni delete: nadie reemplaza, mueve ni borra.
-- -----------------------------------------------------------------------------

-- Leer: la carpeta de mi organización. Director y Gerente leen todo lo de su
-- organización (también lo archivado); los demás, solo si ven la fila de
-- biblioteca de ese objeto, y esa consulta ya pasa por la RLS de la tabla
-- (misma organización y no archivado).
create policy "biblioteca: leer objetos de mi organización"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'biblioteca'
    and (storage.foldername(name))[1] = (select privado.organizacion_actual_id())::text
    and (
      exists (
        select 1
        from privado.usuario_actual() yo
        where yo.rol in ('DIRECTOR_REGIONAL', 'GERENTE')
      )
      or exists (
        select 1
        from public.biblioteca b
        where b.ruta = objects.name
      )
    )
  );

-- Subir: Director y Gerente, en la carpeta de su organización y con el nombre
-- generado (uuid.extensión), sin subcarpetas.
create policy "biblioteca: subir objetos Director y Gerente"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'biblioteca'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|webp|gif|mp4|webm|docx|xlsx|pptx|txt|csv)$'
    and (storage.foldername(name))[1] = (select privado.organizacion_actual_id())::text
    and exists (
      select 1
      from privado.usuario_actual() yo
      where yo.rol in ('DIRECTOR_REGIONAL', 'GERENTE')
    )
  );
