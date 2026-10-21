-- ============================================================
-- STOK · Dejar una sola obra: la que está conectada al flujo n8n
--
-- El flujo n8n v4 trabaja con UNA planilla y UN obra_id. Este script
-- borra las obras de prueba o demo y deja solo esa. Úsalo una vez en
-- Supabase → SQL Editor. Hazlo en dos pasos:
--
--   PASO 1 · Mira qué hay (no cambia nada). Corre solo este SELECT:
--
--     select o.obra_id, o.nombre, o.codigo, o.base_n8n,
--            count(m.usuario) as miembros, o.creada_en
--       from public.obras o left join public.miembros m on m.obra = o.id
--      group by o.id order by o.creada_en;
--
--   PASO 2 · Revisa las dos constantes de abajo y corre TODO el archivo.
--
-- Qué hace el paso 2:
--   · Si la obra a conservar no existe, se detiene sin tocar nada.
--   · Pasa a esa obra a todas las personas de las obras que se borran,
--     como bodegueros (nadie queda sin bodega). Quien ya era miembro
--     conserva su rol.
--   · Borra las otras obras (sus membresías se borran solas).
--   · Deja esa obra como la activa de todos.
--   · Si la obra no tenía dirección de n8n, le pone la del flujo.
--   · Impide crear obras nuevas desde el dashboard o la app.
--     Para volver a permitirlo, corre de nuevo schema.sql.
--
-- No se puede deshacer: las obras borradas no vuelven.
-- ============================================================

do $$
declare
  conservar constant text := 'OBRA-001';                     -- obra_id de la pestaña Lectores
  n8n       constant text := 'https://n8n.stokchile.store';  -- sin barra final
  mantener uuid;
  borradas int;
begin
  select id into mantener from public.obras where upper(obra_id) = upper(conservar);
  if mantener is null then
    raise exception 'No existe una obra con obra_id = %. Revisa el PASO 1 y corrige la constante «conservar».', conservar;
  end if;

  insert into public.miembros (obra, usuario, rol)
  select distinct mantener, m.usuario, 'bodeguero'
    from public.miembros m
   where m.obra <> mantener
  on conflict (obra, usuario) do nothing;

  delete from public.obras where id <> mantener;
  get diagnostics borradas = row_count;

  insert into public.configuracion (user_id, obra_activa)
  select m.usuario, mantener from public.miembros m where m.obra = mantener
  on conflict (user_id) do update set obra_activa = excluded.obra_activa;

  update public.obras set base_n8n = n8n where id = mantener and coalesce(base_n8n, '') = '';

  raise notice 'Listo: % obra(s) borrada(s). Queda solo % (%).', borradas, conservar, mantener;
end $$;

-- Una sola obra: crear_obra queda cerrada. El dashboard y la app ya no ofrecen
-- crear obras; esto evita que se creen igual llamando a la API directamente.
create or replace function public.crear_obra(p_nombre text, p_obra_id text default null)
returns public.obras language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  raise exception 'Esta instalación de STOK trabaja con una sola obra. Pide el código de invitación al jefe de obra.';
end $$;

-- Para comprobar el resultado:
--   select obra_id, nombre, codigo, base_n8n from public.obras;
