-- Gemini Tools Hub ONLY. Does not modify WEBSITE's apps/categories/pages tables.
-- Run once in the Supabase SQL Editor; safe to re-run without clearing data.
-- Add an existing Auth user's UUID to gemini_hub_admins using the dashboard.

create table if not exists public.gemini_hub_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.gemini_hub_state (
  singleton boolean primary key default true check (singleton),
  apps jsonb not null default '[]'::jsonb check (jsonb_typeof(apps) = 'array'),
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
insert into public.gemini_hub_state(singleton) values (true) on conflict do nothing;

alter table public.gemini_hub_admins enable row level security;
alter table public.gemini_hub_state enable row level security;
-- No direct table policies: all access is through the narrow RPCs below.
revoke all on public.gemini_hub_admins from public, anon, authenticated;
revoke all on public.gemini_hub_state from public, anon, authenticated;

create or replace function public.gemini_hub_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.gemini_hub_admins where user_id = auth.uid());
$$;
revoke all on function public.gemini_hub_is_admin() from public, anon, authenticated;

create or replace function public.get_gemini_catalog()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'apps', coalesce((
      select jsonb_agg(item order by position)
      from jsonb_array_elements(state.apps) with ordinality as items(item, position)
      where public.gemini_hub_is_admin() or item->'visible' = 'true'::jsonb
    ), '[]'::jsonb),
    'revision', state.revision,
    'can_edit', public.gemini_hub_is_admin()
  )
  from public.gemini_hub_state state where state.singleton;
$$;
revoke all on function public.get_gemini_catalog() from public, anon, authenticated;
grant execute on function public.get_gemini_catalog() to anon, authenticated;

create or replace function public.save_gemini_catalog(p_apps jsonb, p_revision integer)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  item jsonb;
  field text;
  seen text[] := array[]::text[];
  normalized jsonb := '[]'::jsonb;
  next_revision integer;
  url text;
begin
  if not public.gemini_hub_is_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_apps is null or jsonb_typeof(p_apps) <> 'array' then
    raise exception 'INVALID_CATALOG';
  end if;
  if jsonb_array_length(p_apps) > 500 then raise exception 'TOO_MANY_TOOLS'; end if;
  for item in select value from jsonb_array_elements(p_apps) loop
    if jsonb_typeof(item) <> 'object' then raise exception 'INVALID_TOOL'; end if;
    foreach field in array array['id', 'title', 'desc', 'url', 'emoji', 'category'] loop
      if jsonb_typeof(item->field) is distinct from 'string' then raise exception 'INVALID_FIELD'; end if;
    end loop;
    if length(trim(item->>'id')) = 0 or length(item->>'id') > 64
      or (item->>'id') = any(seen)
      or length(trim(item->>'title')) = 0 or length(item->>'title') > 100
      or length(trim(item->>'emoji')) = 0 or length(item->>'emoji') > 32
      or length(item->>'desc') > 300 or length(item->>'url') > 2048
      or (item->>'category') not in ('創作', '教學', '輔導', '工具', '遊戲')
      or (item ? 'visible' and jsonb_typeof(item->'visible') <> 'boolean') then
      raise exception 'INVALID_TOOL';
    end if;
    url := item->>'url';
    -- Retain /tools/ compatibility for old backups; UI is Share Link first.
    if url ~ '[[:space:][:cntrl:]]' or position(chr(92) in url) > 0 then raise exception 'UNSAFE_URL'; end if;
    if url like 'https://%' then
      if split_part(substring(url from 9), '/', 1) = ''
        or substring(url from 9) ~ '^[/?#]'
        or split_part(regexp_replace(substring(url from 9), '[?#].*$', ''), '/', 1) like '%@%'
      then raise exception 'UNSAFE_URL'; end if;
    elsif url like '/tools/%' then
      if url ~ '(^|/)(\.|%2[eE]){1,2}(/|$)' or url ~* '%2f|%5c' then raise exception 'UNSAFE_URL'; end if;
    else
      raise exception 'UNSAFE_URL';
    end if;
    seen := array_append(seen, item->>'id');
    -- Whitelist fields. Hidden records never leave the read RPC for visitors.
    normalized := normalized || jsonb_build_array(jsonb_build_object(
      'id', item->>'id', 'title', item->>'title', 'desc', item->>'desc',
      'url', url, 'emoji', item->>'emoji', 'category', item->>'category',
      'visible', coalesce(item->'visible', 'true'::jsonb)
    ));
  end loop;
  -- Atomic compare-and-swap: do not overwrite another admin's newer changes.
  update public.gemini_hub_state
    set apps = normalized, revision = revision + 1, updated_at = now()
    where singleton and revision = p_revision
    returning revision into next_revision;
  if not found then raise exception 'CATALOG_CONFLICT' using errcode = '40001'; end if;
  return jsonb_build_object('apps', normalized, 'revision', next_revision, 'can_edit', true);
end;
$$;
revoke all on function public.save_gemini_catalog(jsonb, integer) from public, anon, authenticated;
grant execute on function public.save_gemini_catalog(jsonb, integer) to authenticated;
