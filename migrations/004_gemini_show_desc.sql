-- Gemini Tools Hub: per-tool "showDesc" flag (public description switch).
-- Safe to re-run. Only replaces public.save_gemini_catalog; nothing else
-- (click stats, reports, PIN, retention) is touched.
--
-- Why: the description is an admin note by default. Visitors only see the
-- description text when the admin explicitly opts a tool in (showDesc = true).
-- Old saved items without the flag are normalized to false on the next save,
-- i.e. existing descriptions stop being rendered publicly without data loss.

drop function if exists public.save_gemini_catalog(jsonb, integer, text);
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
      or (item ? 'visible' and jsonb_typeof(item->'visible') <> 'boolean')
      or (item ? 'showDesc' and jsonb_typeof(item->'showDesc') <> 'boolean') then
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
      'visible', coalesce(item->'visible', 'true'::jsonb),
      'showDesc', coalesce(item->'showDesc', 'false'::jsonb)
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
