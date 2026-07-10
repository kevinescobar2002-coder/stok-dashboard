-- STOK · esquema mínimo en Supabase
-- Guarda SOLO cuentas y su configuración. El inventario vive en Google Sheets.
-- Ejecuta este archivo en Supabase → SQL Editor → New query → Run.

create table if not exists public.configuracion (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  base_n8n      text default '',
  obra_id       text default 'OBRA-001',
  link_planilla text default '',
  link_carpeta  text default '',
  actualizado   timestamptz default now()
);

alter table public.configuracion enable row level security;

-- Cada persona solo ve y edita su propia fila.
drop policy if exists "propia configuracion - leer"    on public.configuracion;
drop policy if exists "propia configuracion - insertar" on public.configuracion;
drop policy if exists "propia configuracion - editar"   on public.configuracion;

create policy "propia configuracion - leer"
  on public.configuracion for select using (auth.uid() = user_id);
create policy "propia configuracion - insertar"
  on public.configuracion for insert with check (auth.uid() = user_id);
create policy "propia configuracion - editar"
  on public.configuracion for update using (auth.uid() = user_id);

-- Mantiene la marca de tiempo al día.
create or replace function public.tocar_configuracion()
returns trigger language plpgsql as $$
begin new.actualizado = now(); return new; end $$;

drop trigger if exists tr_tocar_configuracion on public.configuracion;
create trigger tr_tocar_configuracion before update on public.configuracion
  for each row execute function public.tocar_configuracion();
