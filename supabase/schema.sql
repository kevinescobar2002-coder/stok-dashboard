-- ============================================================
-- STOK · Esquema Supabase — cuentas, obras y membresías
--
-- Guarda SOLO cuentas, obras y quién pertenece a cada una.
-- El inventario sigue viviendo en Google Sheets, detrás de n8n.
--
-- Ejecuta este archivo en Supabase → SQL Editor → New query → Run.
-- Es idempotente: puedes volver a correrlo sin romper nada.
-- ============================================================

create extension if not exists pgcrypto;   -- para gen_random_uuid()

-- ------------------------------------------------------------
-- 1. OBRAS
--    Cada obra es un espacio cerrado: su propio n8n, su propia
--    planilla y su propio `obra_id` (la llave que separa las
--    filas dentro de Google Sheets).
-- ------------------------------------------------------------
create table if not exists public.obras (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,          -- código de invitación: STOK-XXXXXX
  nombre        text not null,                 -- "Edificio Los Aromos"
  obra_id       text not null unique,          -- "OBRA-001" — viaja a n8n y a la planilla
  base_n8n      text not null default '',
  link_planilla text not null default '',
  link_carpeta  text not null default '',
  creada_por    uuid references auth.users(id) on delete set null,
  creada_en     timestamptz not null default now(),
  actualizado   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. MIEMBROS
--    Quién ve qué. Una persona puede estar en varias obras.
-- ------------------------------------------------------------
create table if not exists public.miembros (
  obra    uuid not null references public.obras(id)   on delete cascade,
  usuario uuid not null references auth.users(id)     on delete cascade,
  rol     text not null default 'bodeguero' check (rol in ('admin', 'bodeguero')),
  desde   timestamptz not null default now(),
  primary key (obra, usuario)
);

create index if not exists ix_miembros_usuario on public.miembros(usuario);

-- ------------------------------------------------------------
-- 3. CONFIGURACIÓN POR USUARIO
--    Ya solo recuerda en qué obra estaba trabajando la persona.
--    Las columnas base_n8n/obra_id/links quedan por compatibilidad
--    con la versión anterior: la configuración real vive en `obras`.
-- ------------------------------------------------------------
create table if not exists public.configuracion (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  base_n8n      text default '',
  obra_id       text default 'OBRA-001',
  link_planilla text default '',
  link_carpeta  text default '',
  actualizado   timestamptz default now()
);

alter table public.configuracion
  add column if not exists obra_activa uuid references public.obras(id) on delete set null;

-- ------------------------------------------------------------
-- 4. AYUDANTES
--    `security definer` a propósito: las políticas de `obras` y
--    `miembros` se consultan entre sí, y sin esto Postgres entra
--    en recursión infinita al evaluar RLS.
-- ------------------------------------------------------------
create or replace function public.es_miembro(p_obra uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.miembros
     where obra = p_obra and usuario = auth.uid()
  );
$$;

create or replace function public.es_admin(p_obra uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.miembros
     where obra = p_obra and usuario = auth.uid() and rol = 'admin'
  );
$$;

-- Código de invitación. Alfabeto sin I/O/0/1 para que nadie lo dicte mal
-- por teléfono. 32^6 ≈ mil millones de combinaciones.
create or replace function public.nuevo_codigo()
returns text language plpgsql volatile
set search_path = public, pg_temp as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text; i int;
begin
  loop
    c := 'STOK-';
    for i in 1..6 loop
      c := c || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.obras where codigo = c);
  end loop;
  return c;
end $$;

-- Devuelve un identificador de obra que no esté tomado.
create or replace function public.slug_libre(p_slug text)
returns text language plpgsql volatile
set search_path = public, pg_temp as $$
declare s text; base text; n int := 1;
begin
  s := upper(coalesce(nullif(trim(p_slug), ''), 'OBRA-001'));
  base := s;
  while exists (select 1 from public.obras where upper(obra_id) = s) loop
    n := n + 1;
    s := base || '-' || n;
  end loop;
  return s;
end $$;

-- Normaliza lo que la persona escriba: "stok-a1b2c3", " A1B2C3 " → "STOK-A1B2C3"
create or replace function public.normalizar_codigo(p_codigo text)
returns text language sql immutable as $$
  select case
    when upper(trim(coalesce(p_codigo, ''))) like 'STOK-%' then upper(trim(p_codigo))
    else 'STOK-' || upper(trim(coalesce(p_codigo, '')))
  end;
$$;

-- ------------------------------------------------------------
-- 5. CREAR UNA OBRA
--    Quien la crea queda como admin y la obra pasa a ser su activa.
-- ------------------------------------------------------------
create or replace function public.crear_obra(p_nombre text, p_obra_id text default null)
returns public.obras language plpgsql security definer
set search_path = public, pg_temp as $$
declare o public.obras; slug text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para crear una obra.';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'La obra necesita un nombre.';
  end if;

  if coalesce(trim(p_obra_id), '') = '' then
    slug := public.slug_libre('OBRA-001');
  else
    slug := upper(regexp_replace(trim(p_obra_id), '[^A-Za-z0-9_-]', '', 'g'));
    if exists (select 1 from public.obras where upper(obra_id) = slug) then
      raise exception 'Ya existe una obra con el identificador %. Elige otro.', slug;
    end if;
  end if;

  insert into public.obras (codigo, nombre, obra_id, creada_por)
  values (public.nuevo_codigo(), trim(p_nombre), slug, auth.uid())
  returning * into o;

  insert into public.miembros (obra, usuario, rol)
  values (o.id, auth.uid(), 'admin');

  insert into public.configuracion (user_id, obra_activa)
  values (auth.uid(), o.id)
  on conflict (user_id) do update set obra_activa = excluded.obra_activa;

  return o;
end $$;

-- ------------------------------------------------------------
-- 6. UNIRSE A UNA OBRA CON EL CÓDIGO
--    Es `security definer` para que nadie pueda leer la tabla de
--    obras buscando códigos: solo se entra sabiendo el correcto.
-- ------------------------------------------------------------
create or replace function public.unirse_a_obra(p_codigo text)
returns public.obras language plpgsql security definer
set search_path = public, pg_temp as $$
declare o public.obras;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para unirte a una obra.';
  end if;

  select * into o from public.obras
   where codigo = public.normalizar_codigo(p_codigo);

  if not found then
    raise exception 'El código no corresponde a ninguna obra.';
  end if;

  insert into public.miembros (obra, usuario, rol)
  values (o.id, auth.uid(), 'bodeguero')
  on conflict (obra, usuario) do nothing;

  insert into public.configuracion (user_id, obra_activa)
  values (auth.uid(), o.id)
  on conflict (user_id) do update set obra_activa = excluded.obra_activa;

  return o;
end $$;

-- ------------------------------------------------------------
-- 7. ROTAR EL CÓDIGO (solo admin)
--    Para cuando alguien sale del equipo y el código ya circuló.
-- ------------------------------------------------------------
create or replace function public.rotar_codigo(p_obra uuid)
returns text language plpgsql security definer
set search_path = public, pg_temp as $$
declare c text;
begin
  if not public.es_admin(p_obra) then
    raise exception 'Solo un administrador de la obra puede cambiar su código.';
  end if;
  c := public.nuevo_codigo();
  update public.obras set codigo = c where id = p_obra;
  return c;
end $$;

-- ------------------------------------------------------------
-- 8. RLS
-- ------------------------------------------------------------
alter table public.obras         enable row level security;
alter table public.miembros      enable row level security;
alter table public.configuracion enable row level security;

drop policy if exists "obras - leer"      on public.obras;
drop policy if exists "obras - editar"    on public.obras;
drop policy if exists "obras - borrar"    on public.obras;
-- No hay política de INSERT en `obras`: solo se crean vía crear_obra().
create policy "obras - leer"   on public.obras for select using (public.es_miembro(id));
create policy "obras - editar" on public.obras for update using (public.es_admin(id))
                                                      with check (public.es_admin(id));
create policy "obras - borrar" on public.obras for delete using (public.es_admin(id));

drop policy if exists "miembros - leer"   on public.miembros;
drop policy if exists "miembros - editar" on public.miembros;
drop policy if exists "miembros - salir"  on public.miembros;
-- No hay política de INSERT: solo se entra vía unirse_a_obra() o crear_obra().
create policy "miembros - leer"   on public.miembros for select using (public.es_miembro(obra));
create policy "miembros - editar" on public.miembros for update using (public.es_admin(obra))
                                                            with check (public.es_admin(obra));
create policy "miembros - salir"  on public.miembros for delete
  using (usuario = auth.uid() or public.es_admin(obra));

drop policy if exists "propia configuracion - leer"     on public.configuracion;
drop policy if exists "propia configuracion - insertar" on public.configuracion;
drop policy if exists "propia configuracion - editar"   on public.configuracion;
create policy "propia configuracion - leer"     on public.configuracion for select using (auth.uid() = user_id);
create policy "propia configuracion - insertar" on public.configuracion for insert with check (auth.uid() = user_id);
create policy "propia configuracion - editar"   on public.configuracion for update using (auth.uid() = user_id)
                                                                              with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 9. PERMISOS DE EJECUCIÓN
--    nuevo_codigo() y slug_libre() quedan cerrados: se usan solo
--    dentro de las funciones de arriba, que corren como dueñas.
-- ------------------------------------------------------------
revoke execute on function public.nuevo_codigo()        from public, anon, authenticated;
revoke execute on function public.slug_libre(text)      from public, anon, authenticated;
revoke execute on function public.crear_obra(text,text) from public, anon;
revoke execute on function public.unirse_a_obra(text)   from public, anon;
revoke execute on function public.rotar_codigo(uuid)    from public, anon;
grant  execute on function public.crear_obra(text,text) to authenticated;
grant  execute on function public.unirse_a_obra(text)   to authenticated;
grant  execute on function public.rotar_codigo(uuid)    to authenticated;
grant  execute on function public.es_miembro(uuid)      to authenticated;
grant  execute on function public.es_admin(uuid)        to authenticated;

-- ------------------------------------------------------------
-- 10. MARCAS DE TIEMPO
-- ------------------------------------------------------------
create or replace function public.tocar_fila()
returns trigger language plpgsql as $$
begin new.actualizado = now(); return new; end $$;

drop trigger if exists tr_tocar_obras on public.obras;
create trigger tr_tocar_obras before update on public.obras
  for each row execute function public.tocar_fila();

drop trigger if exists tr_tocar_configuracion on public.configuracion;
create trigger tr_tocar_configuracion before update on public.configuracion
  for each row execute function public.tocar_fila();

-- La versión anterior del esquema dejaba esta función suelta.
drop function if exists public.tocar_configuracion();

-- ------------------------------------------------------------
-- 11. MIGRACIÓN DE LO QUE YA EXISTÍA
--     Convierte cada configuración vieja en una obra. Las personas
--     que apuntaban al mismo n8n y al mismo obra_id quedan juntas
--     en la misma obra; la primera de ellas queda como admin.
--     Solo corre si aún no hay obras creadas.
-- ------------------------------------------------------------
do $$
declare r record; nueva uuid;
begin
  if exists (select 1 from public.obras) then
    raise notice 'Ya hay obras creadas: se omite la migración.';
    return;
  end if;

  for r in
    select base_n8n,
           coalesce(nullif(trim(obra_id), ''), 'OBRA-001') as slug,
           min(link_planilla) as planilla,
           min(link_carpeta)  as carpeta,
           (array_agg(user_id order by actualizado nulls last))[1] as dueno,
           array_agg(user_id) as usuarios
      from public.configuracion
     where coalesce(base_n8n, '') <> ''
     group by base_n8n, coalesce(nullif(trim(obra_id), ''), 'OBRA-001')
  loop
    insert into public.obras (codigo, nombre, obra_id, base_n8n, link_planilla, link_carpeta, creada_por)
    values (public.nuevo_codigo(), r.slug, public.slug_libre(r.slug),
            r.base_n8n, coalesce(r.planilla, ''), coalesce(r.carpeta, ''), r.dueno)
    returning id into nueva;

    insert into public.miembros (obra, usuario, rol)
    select nueva, u, case when u = r.dueno then 'admin' else 'bodeguero' end
      from unnest(r.usuarios) as u
    on conflict (obra, usuario) do nothing;

    update public.configuracion set obra_activa = nueva where user_id = any(r.usuarios);

    raise notice 'Obra creada: % (%)', r.slug, nueva;
  end loop;
end $$;

-- Para ver los códigos que quedaron tras la migración:
--   select nombre, obra_id, codigo from public.obras;
