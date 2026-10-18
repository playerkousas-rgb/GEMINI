-- Gemini Tools Hub: shared-PIN admin gate, daily click stats, visitor reports.
-- Adds ONLY gemini_hub_* objects. Does not touch WEBSITE's apps/categories/pages.
-- Safe to re-run. Slimming rules: clicks aggregate per day (no raw event rows),
-- reports auto-prune after 90 days and are rate-limited to 20/day.
--
-- Admin access is a shared PIN (default '0728') checked inside the RPCs.
-- Change it with: update public.gemini_hub_state set pin = '...' where singleton;
-- The PIN is a light cover for an inconspicuous EDIT entrance, not a secret vault.

-- PIN lives on the state row; RLS + revoked grants mean only RPCs can read it.
alter table public.gemini_hub_state
  add column if not exists pin text not null default '0728';

-- Click aggregates: at most (#tools x #days) tiny integer rows. Never raw events.
create table if not exists public.gemini_hub_clicks (
  tool_id text not null check (length(tool_id) between 1 and 64),
  day date not null default current_date,
  count integer not null default 0 check (count >= 0),
  primary key (tool_id, day)
);

-- Visitor reports. Old rows are pruned on every submission.
create table if not exists public.gemini_hub_reports (
  id bigint generated always as identity primary key,
  tool_id text not null check (length(tool_id) between 1 and 64),
  tool_title text not null default '' check (length(tool_title) <= 100),
  message text not null default '' check (length(message) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists gemini_hub_reports_created_idx
  on public.gemini_hub_reports (created_at desc);

alter table public.gemini_hub_clicks enable row level security;
alter table public.gemini_hub_reports enable row level security;
-- No direct table policies: all access is through the narrow RPCs below.
revoke all on public.gemini_hub_clicks from public, anon, authenticated;
revoke all on public.gemini_hub_reports from public, anon, authenticated;

-- Replace the Supabase-Auth whitelist model with the shared PIN.
drop function if exists public.gemini_hub_is_admin();
drop table if exists public.gemini_hub_admins;

create or replace function public.gemini_hub_is_admin(p_pin text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select p_pin is not null and exists (
    select 1 from public.gemini_hub_state s where s.singleton and s.pin = p_pin
  );
$$;
revoke all on function public.gemini_hub_is_admin(text) from public, anon, authenticated;

drop function if exists public.get_gemini_catalog();
create or replace function public.get_gemini_catalog(p_pin text default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'apps', coalesce((
      select jsonb_agg(item order by position)
      from jsonb_array_elements(state.apps) with ordinality as items(item, position)
      where public.gemini_hub_is_admin(p_pin) or item->'visible' = 'true'::jsonb
    ), '[]'::jsonb),
    'revision', state.revision,
    'can_edit', public.gemini_hub_is_admin(p_pin)
  )
  from public.gemini_hub_state state where state.singleton;
$$;
revoke all on function public.get_gemini_catalog(text) from public, anon, authenticated;
grant execute on function public.get_gemini_catalog(text) to anon, authenticated;

drop function if exists public.save_gemini_catalog(jsonb, integer);
create or replace function public.save_gemini_catalog(p_apps jsonb, p_revision integer, p_pin text)
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
  if not public.gemini_hub_is_admin(p_pin) then
    raise exception 'INVALID_PIN' using errcode = '42501';
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
  -- Atomic compare-and-swap: do not overwrite another session's newer changes.
  update public.gemini_hub_state
    set apps = normalized, revision = revision + 1, updated_at = now()
    where singleton and revision = p_revision
    returning revision into next_revision;
  if not found then raise exception 'CATALOG_CONFLICT' using errcode = '40001'; end if;
  return jsonb_build_object('apps', normalized, 'revision', next_revision, 'can_edit', true);
end;
$$;
revoke all on function public.save_gemini_catalog(jsonb, integer, text) from public, anon, authenticated;
grant execute on function public.save_gemini_catalog(jsonb, integer, text) to anon, authenticated;

-- Anonymous click beacon: one increment per tool per day. Never throws to UX.
create or replace function public.record_gemini_click(p_tool_id text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_tool_id is null or length(p_tool_id) < 1 or length(p_tool_id) > 64 then
    raise exception 'INVALID_TOOL_ID';
  end if;
  insert into public.gemini_hub_clicks (tool_id, day, count)
  values (p_tool_id, current_date, 1)
  on conflict (tool_id, day) do update
    set count = public.gemini_hub_clicks.count + 1;
end;
$$;
revoke all on function public.record_gemini_click(text) from public, anon, authenticated;
grant execute on function public.record_gemini_click(text) to anon, authenticated;

-- Anonymous report intake with 90-day pruning and a 20/day cap (slim + abuse-safe).
create or replace function public.submit_gemini_report(p_tool_id text, p_tool_title text, p_message text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_tool_id is null or length(p_tool_id) < 1 or length(p_tool_id) > 64 then
    raise exception 'INVALID_TOOL_ID';
  end if;
  if p_tool_title is null or length(p_tool_title) > 100 then
    raise exception 'INVALID_TITLE';
  end if;
  if p_message is null or length(p_message) > 300 then
    raise exception 'INVALID_MESSAGE';
  end if;
  -- Slimming: keep the table tiny forever.
  delete from public.gemini_hub_reports where created_at < now() - interval '90 days';
  if (select count(*) from public.gemini_hub_reports
      where created_at >= date_trunc('day', now())) >= 20 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  insert into public.gemini_hub_reports (tool_id, tool_title, message)
  values (p_tool_id, p_tool_title, coalesce(p_message, ''));
end;
$$;
revoke all on function public.submit_gemini_report(text, text, text) from public, anon, authenticated;
grant execute on function public.submit_gemini_report(text, text, text) to anon, authenticated;

-- Admin stats: per-tool totals + last 30 days of daily counts.
create or replace function public.get_gemini_stats(p_pin text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.gemini_hub_is_admin(p_pin) then
    raise exception 'INVALID_PIN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'totals', coalesce((
      select jsonb_agg(jsonb_build_object('tool_id', tool_id, 'count', total) order by total desc)
      from (select tool_id, sum(count)::int as total
            from public.gemini_hub_clicks group by tool_id) t
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tool_id', tool_id, 'day', to_char(day, 'YYYY-MM-DD'), 'count', count) order by day desc)
      from public.gemini_hub_clicks where day >= current_date - 29
    ), '[]'::jsonb),
    'grand_total', coalesce((select sum(count) from public.gemini_hub_clicks), 0),
    'today', coalesce((select sum(count) from public.gemini_hub_clicks
                       where day = current_date), 0)
  );
end;
$$;
revoke all on function public.get_gemini_stats(text) from public, anon, authenticated;
grant execute on function public.get_gemini_stats(text) to anon, authenticated;

-- Admin report inbox: newest first, capped at 100 items per read.
create or replace function public.get_gemini_reports(p_pin text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_total bigint;
begin
  if not public.gemini_hub_is_admin(p_pin) then
    raise exception 'INVALID_PIN' using errcode = '42501';
  end if;
  select count(*) into v_total from public.gemini_hub_reports;
  return jsonb_build_object(
    'reports', coalesce((
      select jsonb_agg(r order by created_at desc) from (
        select id, tool_id, tool_title, message, created_at
        from public.gemini_hub_reports order by created_at desc limit 100
      ) r
    ), '[]'::jsonb),
    'total', v_total
  );
end;
$$;
revoke all on function public.get_gemini_reports(text) from public, anon, authenticated;
grant execute on function public.get_gemini_reports(text) to anon, authenticated;

-- Admin dismisses a report by deleting it (keeps the table slim).
create or replace function public.delete_gemini_report(p_pin text, p_id bigint)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.gemini_hub_is_admin(p_pin) then
    raise exception 'INVALID_PIN' using errcode = '42501';
  end if;
  delete from public.gemini_hub_reports where id = p_id;
end;
$$;
revoke all on function public.delete_gemini_report(text, bigint) from public, anon, authenticated;
grant execute on function public.delete_gemini_report(text, bigint) to anon, authenticated;
