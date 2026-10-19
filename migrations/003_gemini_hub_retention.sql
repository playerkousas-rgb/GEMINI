-- Gemini Tools Hub: bounded retention for daily click aggregates and reports.
-- Safe to re-run. Cleanup is opportunistic (no cron / serverless function needed):
-- the first click or report submission each database day prunes expired rows.
-- Click aggregates retain a rolling 365 days; reports retain 90 days.

create table if not exists public.gemini_hub_maintenance (
  singleton boolean primary key default true check (singleton),
  last_cleanup date not null default (current_date - 1)
);
insert into public.gemini_hub_maintenance (singleton)
values (true) on conflict (singleton) do nothing;

alter table public.gemini_hub_maintenance enable row level security;
revoke all on public.gemini_hub_maintenance from public, anon, authenticated;

-- Atomic daily gate: concurrent traffic can run cleanup at most once per date.
create or replace function public.gemini_hub_prune_old_data()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  should_prune boolean := false;
begin
  update public.gemini_hub_maintenance
    set last_cleanup = current_date
    where singleton and last_cleanup < current_date
    returning true into should_prune;

  if coalesce(should_prune, false) then
    delete from public.gemini_hub_clicks
      where day < current_date - 364;
    delete from public.gemini_hub_reports
      where created_at < now() - interval '90 days';
  end if;
end;
$$;
revoke all on function public.gemini_hub_prune_old_data() from public, anon, authenticated;

-- One daily row per tool remains the storage unit; discard rows outside the
-- retention window during this low-cost, once-a-day housekeeping pass.
create or replace function public.record_gemini_click(p_tool_id text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_tool_id is null or length(p_tool_id) < 1 or length(p_tool_id) > 64 then
    raise exception 'INVALID_TOOL_ID';
  end if;
  perform public.gemini_hub_prune_old_data();
  insert into public.gemini_hub_clicks (tool_id, day, count)
  values (p_tool_id, current_date, 1)
  on conflict (tool_id, day) do update
    set count = public.gemini_hub_clicks.count + 1;
end;
$$;
revoke all on function public.record_gemini_click(text) from public, anon, authenticated;
grant execute on function public.record_gemini_click(text) to anon, authenticated;

-- The same daily maintenance gate also cleans up if the site gets reports but
-- no clicks. The existing 20/day cap still bounds abusive report submissions.
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
  perform public.gemini_hub_prune_old_data();
  if (select count(*) from public.gemini_hub_reports
      where created_at >= date_trunc('day', now())) >= 20 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  insert into public.gemini_hub_reports (tool_id, tool_title, message)
  values (p_tool_id, p_tool_title, p_message);
end;
$$;
revoke all on function public.submit_gemini_report(text, text, text) from public, anon, authenticated;
grant execute on function public.submit_gemini_report(text, text, text) to anon, authenticated;
