-- C2 Recall · esquema de sincronización para Supabase (plan gratuito).
-- La base local (IndexedDB) es la fuente de verdad; Supabase guarda una copia por usuario para
-- sincronizar dispositivos. Todo está protegido con Row Level Security: cada fila pertenece a auth.uid().
-- Ejecutar una sola vez en Supabase → SQL Editor → New query → Run.

-- 1) Registros versionados (conocimientos, tarjetas, mazos, ajustes, fuentes, errores, lotes).
create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null check (collection in ('knowledge','cards','decks','settings','sources','errorLogs','importBatches')),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null,            -- marca del cliente (última edición)
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),  -- cursor para descargar cambios
  primary key (user_id, collection, id)
);
create index if not exists records_pull_idx on public.records (user_id, server_updated_at);

-- 2) Eventos de repaso: solo se agregan (append-only). El id es único, así que enviar dos veces
--    el mismo repaso no lo duplica.
create table if not exists public.review_events (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id uuid not null,
  card_id text not null,
  reviewed_at timestamptz not null,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists review_events_pull_idx on public.review_events (user_id, server_updated_at);

-- server_updated_at siempre lo pone el servidor (no se puede falsificar desde el cliente).
create or replace function public.touch_server_updated_at() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := now();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_server_updated_at();
drop trigger if exists review_events_touch on public.review_events;
create trigger review_events_touch before insert or update on public.review_events
  for each row execute function public.touch_server_updated_at();

alter table public.records enable row level security;
alter table public.review_events enable row level security;

drop policy if exists "records: own rows" on public.records;
create policy "records: own rows" on public.records
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "review_events: own rows" on public.review_events;
create policy "review_events: own rows" on public.review_events
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3) Subida con «última escritura gana»: solo se sobrescribe si el cambio entrante es más nuevo.
create or replace function public.push_records(items jsonb) returns integer
language sql security invoker set search_path = public as $$
  with incoming as (
    select x->>'collection' as collection, x->>'id' as id, x->'data' as data,
           (x->>'updated_at')::timestamptz as updated_at, coalesce((x->>'deleted')::boolean, false) as deleted
    from jsonb_array_elements(items) as x
  ), upserted as (
    insert into public.records as r (user_id, collection, id, data, updated_at, deleted)
    select auth.uid(), collection, id, data, updated_at, deleted from incoming
    on conflict (user_id, collection, id) do update
      set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted
      where r.updated_at <= excluded.updated_at
    returning 1
  )
  select count(*)::integer from upserted;
$$;

create or replace function public.push_reviews(items jsonb) returns integer
language sql security invoker set search_path = public as $$
  with incoming as (
    select (x->>'id')::uuid as id, x->>'card_id' as card_id, (x->>'reviewed_at')::timestamptz as reviewed_at,
           x->'data' as data, (x->>'updated_at')::timestamptz as updated_at, coalesce((x->>'deleted')::boolean, false) as deleted
    from jsonb_array_elements(items) as x
  ), upserted as (
    insert into public.review_events as r (user_id, id, card_id, reviewed_at, data, updated_at, deleted)
    select auth.uid(), id, card_id, reviewed_at, data, updated_at, deleted from incoming
    on conflict (user_id, id) do update
      set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted
      where r.updated_at <= excluded.updated_at
    returning 1
  )
  select count(*)::integer from upserted;
$$;

revoke all on function public.push_records(jsonb) from public, anon;
revoke all on function public.push_reviews(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;
grant execute on function public.push_reviews(jsonb) to authenticated;

-- 4) Integración directa (Método 2): bandeja de importación + tokens personales.
--    Una herramienta autorizada (por ejemplo Claude con tu token) envía un lote a la bandeja;
--    nada entra a tu biblioteca hasta que lo revisás y confirmás en la app.
create table if not exists public.import_tokens (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token_hash text not null primary key,       -- sha256 del token; el token en claro nunca se guarda
  label text not null default 'Token de importación',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.import_tokens enable row level security;
drop policy if exists "import_tokens: own rows" on public.import_tokens;
create policy "import_tokens: own rows" on public.import_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.import_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','applied','discarded')),
  created_at timestamptz not null default now()
);
create index if not exists import_inbox_user_idx on public.import_inbox (user_id, status, created_at);
alter table public.import_inbox enable row level security;
drop policy if exists "import_inbox: read own" on public.import_inbox;
create policy "import_inbox: read own" on public.import_inbox
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "import_inbox: update own" on public.import_inbox;
create policy "import_inbox: update own" on public.import_inbox
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "import_inbox: delete own" on public.import_inbox;
create policy "import_inbox: delete own" on public.import_inbox
  for delete to authenticated using (user_id = auth.uid());

-- Endpoint: POST /rest/v1/rpc/submit_import  { "token": "...", "title": "...", "payload": { ... } }
-- Valida el token (sha256) y deja el lote en la bandeja del dueño del token. Límite: 2 MB y 30 lotes por hora.
create or replace function public.submit_import(token text, title text, payload jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  new_id uuid;
  recent integer;
begin
  if token is null or length(token) < 32 then raise exception 'invalid token'; end if;
  select t.user_id into owner from public.import_tokens t where t.token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex');
  if owner is null then raise exception 'invalid token'; end if;
  if pg_column_size(payload) > 2 * 1024 * 1024 then raise exception 'payload too large'; end if;
  if jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'payload.items must be an array'; end if;
  select count(*) into recent from public.import_inbox i where i.user_id = owner and i.created_at > now() - interval '1 hour';
  if recent >= 30 then raise exception 'rate limit exceeded'; end if;
  insert into public.import_inbox (user_id, title, payload) values (owner, coalesce(nullif(title, ''), 'Lote importado'), payload)
    returning id into new_id;
  update public.import_tokens set last_used_at = now() where token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex');
  return new_id;
end $$;

revoke all on function public.submit_import(text, text, jsonb) from public;
grant execute on function public.submit_import(text, text, jsonb) to anon, authenticated;
