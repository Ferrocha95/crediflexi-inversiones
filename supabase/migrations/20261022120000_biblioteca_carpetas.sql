-- =============================================================================
-- Migración: biblioteca_carpetas
-- Subcarpetas de UN solo nivel dentro de cada sección (categoría) de la
-- Biblioteca. Cada elemento está en una carpeta de su misma sección y
-- organización, o "Sin carpeta" (carpeta_id nulo).
--   Leer: usuarios activos de la misma organización; lo archivado, solo
--         Director regional y Gerente.
--   Crear: solo Director regional y Gerente, en su organización
--          (organizacion_id y creado_por los pone la base).
--   Archivar: solo Director regional y Gerente de la organización; solo la
--             columna archivado_en, y solo si la carpeta no tiene elementos
--             activos (trigger). Nadie borra. Sin renombrar.
--   Mover: Director regional y Gerente cambian biblioteca.carpeta_id. La
--          llave compuesta (carpeta_id, categoria, organizacion_id) impide
--          salir de la sección o de la organización; un trigger impide entrar
--          o restaurar en una carpeta archivada.
-- El tope de 30 carpetas activas por sección lo valida la app (pendiente
-- reforzarlo en la base). El almacenamiento (bucket y rutas) no cambia.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tabla de carpetas
-- -----------------------------------------------------------------------------
create table public.biblioteca_carpetas (
  id              uuid        primary key default gen_random_uuid(),
  organizacion_id uuid        not null default privado.organizacion_actual_id()
                              references public.organizaciones (id) on delete restrict,
  categoria       public.categoria_biblioteca not null,
  nombre          text        not null,
  creado_por      uuid        not null default privado.usuario_actual_id()
                              references public.usuarios (id) on delete restrict,
  creado_en       timestamptz not null default now(),
  archivado_en    timestamptz,
  constraint biblioteca_carpetas_nombre_no_vacio
    check (btrim(nombre) <> ''),
  constraint biblioteca_carpetas_nombre_largo_maximo
    check (char_length(nombre) <= 80),
  constraint biblioteca_carpetas_nombre_sin_espacios_extremos
    check (nombre = btrim(nombre)),
  -- Sin controles (C0, DEL, C1; el byte nulo no cabe en text) ni invisibles: guion suave, U+034F, marca
  -- árabe, rellenos hangul, separadores mongoles, ancho cero y marcas de
  -- dirección, separadores de línea y párrafo, aislamientos y operadores
  -- invisibles, selectores de variación, BOM y anclas de interlineado.
  -- La misma lista que INVISIBLES en src/aplicacion/biblioteca/reglas.ts.
  constraint biblioteca_carpetas_nombre_sin_invisibles
    check (nombre !~ '[\u0001-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u2028-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF9-\uFFFB]'),
  constraint biblioteca_carpetas_sin_datos_sensibles
    check (privado.parece_dato_sensible(nombre) is null),
  -- Destino de la llave compuesta de public.biblioteca.
  constraint biblioteca_carpetas_id_categoria_organizacion_unico
    unique (id, categoria, organizacion_id)
);

comment on column public.biblioteca_carpetas.archivado_en is
  'Nulo = activa. La hora la pone el servidor al archivar. Solo se archiva sin elementos activos.';

-- Nombre único dentro de su sección entre las activas, sin distinguir
-- mayúsculas. También sirve a las políticas (filtran por organización).
create unique index biblioteca_carpetas_nombre_unico_activas
  on public.biblioteca_carpetas (organizacion_id, categoria, lower(nombre))
  where archivado_en is null;

create index biblioteca_carpetas_organizacion_categoria_idx
  on public.biblioteca_carpetas (organizacion_id, categoria);

create index biblioteca_carpetas_creado_por_idx
  on public.biblioteca_carpetas (creado_por);


-- -----------------------------------------------------------------------------
-- 2. Columna carpeta_id en biblioteca, con llave foránea COMPUESTA
-- Con carpeta_id nulo ("Sin carpeta") la llave no se revisa (MATCH SIMPLE).
-- categoria y organizacion_id no se pueden actualizar: un elemento nunca
-- apunta a una carpeta de otra sección ni de otra organización.
-- -----------------------------------------------------------------------------
alter table public.biblioteca
  add column carpeta_id uuid;

alter table public.biblioteca
  add constraint biblioteca_carpeta_misma_seccion_y_organizacion
  foreign key (carpeta_id, categoria, organizacion_id)
  references public.biblioteca_carpetas (id, categoria, organizacion_id)
  on delete restrict;

create index biblioteca_carpeta_idx
  on public.biblioteca (carpeta_id);


-- -----------------------------------------------------------------------------
-- 3. Triggers
-- -----------------------------------------------------------------------------

-- Al archivar una carpeta, la hora la pone el servidor (misma función que
-- prospectos y biblioteca).
create trigger biblioteca_carpetas_fijar_archivado_en
  before update of archivado_en on public.biblioteca_carpetas
  for each row execute function public.fijar_archivado_en();

-- Una carpeta solo se archiva si no tiene elementos activos. security definer
-- para contar sin depender de la política de lectura de biblioteca. La
-- carrera con un elemento que entra a la vez la cierra exigir_carpeta_activa(),
-- que bloquea la fila de la carpeta (for share).
create function public.impedir_archivar_carpeta_con_elementos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archivado_en is not null
     and old.archivado_en is null
     and exists (
       select 1
       from public.biblioteca b
       where b.carpeta_id = new.id
         and b.archivado_en is null
     ) then
    raise exception 'la carpeta tiene elementos activos (biblioteca_carpetas_sin_elementos_activos)'
      using errcode = 'check_violation',
            constraint = 'biblioteca_carpetas_sin_elementos_activos',
            hint = 'Mueve o archiva sus elementos y vuelve a intentar.';
  end if;
  return new;
end;
$$;

create trigger biblioteca_carpetas_impedir_archivar_con_elementos
  before update of archivado_en on public.biblioteca_carpetas
  for each row execute function public.impedir_archivar_carpeta_con_elementos();

-- Un elemento no entra (insertar), no se mueve (cambiar carpeta_id) ni se
-- restaura (archivado_en de no nulo a nulo) en una carpeta archivada. Bloquea
-- la fila de la carpeta (for share) para que un archivado simultáneo espere o
-- vea el elemento. security definer para leer la carpeta sin depender de su
-- política de lectura. La carpeta se busca SOLO en la sección y la
-- organización del elemento: una carpeta ajena no revela si está archivada ni
-- queda bloqueada; si no se encuentra, decide la llave compuesta (23503).
create function public.exigir_carpeta_activa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archivada boolean;
begin
  if new.carpeta_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.carpeta_id is not distinct from old.carpeta_id
     and not (old.archivado_en is not null and new.archivado_en is null) then
    return new;
  end if;

  select c.archivado_en is not null
    into v_archivada
    from public.biblioteca_carpetas c
   where c.id = new.carpeta_id
     and c.organizacion_id = new.organizacion_id
     and c.categoria = new.categoria
     for share;

  -- Si no está en la sección y organización del elemento (o no existe), no se
  -- hace nada: decide la llave compuesta.
  if v_archivada then
    if tg_op = 'UPDATE'
       and new.carpeta_id is not distinct from old.carpeta_id then
      raise exception 'la carpeta del elemento está archivada (biblioteca_restaurar_en_carpeta_archivada)'
        using errcode = 'check_violation',
              constraint = 'biblioteca_restaurar_en_carpeta_archivada',
              hint = 'Muévelo a otra carpeta o a Sin carpeta antes de restaurarlo.';
    end if;
    raise exception 'la carpeta está archivada (biblioteca_carpeta_archivada)'
      using errcode = 'check_violation',
            constraint = 'biblioteca_carpeta_archivada',
            hint = 'Elige una carpeta activa o Sin carpeta.';
  end if;
  return new;
end;
$$;

create trigger biblioteca_exigir_carpeta_activa
  before insert or update of carpeta_id, archivado_en on public.biblioteca
  for each row execute function public.exigir_carpeta_activa();

revoke execute on function public.impedir_archivar_carpeta_con_elementos() from public, anon, authenticated;
revoke execute on function public.exigir_carpeta_activa()                  from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. Seguridad: RLS y permisos mínimos, columna por columna.
-- En carpetas, id, organizacion_id, creado_por, creado_en y archivado_en (al
-- crear) los pone la base; solo se actualiza archivado_en (sin renombrar).
-- Sin DELETE: nadie borra, se archiva. En biblioteca se suma carpeta_id a lo
-- que se inserta y a lo que se actualiza.
-- -----------------------------------------------------------------------------
alter table public.biblioteca_carpetas enable row level security;

revoke all on table public.biblioteca_carpetas from anon, authenticated;

grant select on table public.biblioteca_carpetas to authenticated;
grant insert (categoria, nombre)
  on table public.biblioteca_carpetas to authenticated;
grant update (archivado_en)
  on table public.biblioteca_carpetas to authenticated;

grant insert (carpeta_id) on table public.biblioteca to authenticated;
grant update (carpeta_id) on table public.biblioteca to authenticated;


-- -----------------------------------------------------------------------------
-- 5. Políticas de carpetas
-- Un usuario inactivo no obtiene fila de usuario_actual() ni organización:
-- no lee ni escribe. Mover un elemento usa la política de actualizar de
-- biblioteca (Director y Gerente de la organización).
-- -----------------------------------------------------------------------------
create policy "biblioteca_carpetas: leer las de mi organización"
  on public.biblioteca_carpetas
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

create policy "biblioteca_carpetas: crear Director y Gerente"
  on public.biblioteca_carpetas
  for insert
  to authenticated
  with check (
    creado_por = (select privado.usuario_actual_id())
    and organizacion_id = (select privado.organizacion_actual_id())
    and exists (
      select 1
      from privado.usuario_actual() yo
      where yo.rol in ('DIRECTOR_REGIONAL', 'GERENTE')
    )
  );

create policy "biblioteca_carpetas: archivar Director y Gerente"
  on public.biblioteca_carpetas
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
