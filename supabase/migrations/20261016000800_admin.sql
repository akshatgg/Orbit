-- Admin dashboard: audit log + stats helpers.
-- Re-runnable: everything is create-or-replace / if-not-exists.

-- ═══ Audit log ══════════════════════════════════════════════════════════════
-- Every admin action (approve organiser, cancel event, add admin…) leaves a row here.
-- Rows are written only through log_admin_action(), which stamps the actor itself.

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor       uuid references auth.users (id) on delete set null,
  action      text not null check (char_length(action) between 1 and 80),
  target_type text not null check (char_length(target_type) between 1 and 40),
  target_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx on public.admin_audit_log (target_type, target_id);

alter table public.admin_audit_log enable row level security;

revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;
grant all on public.admin_audit_log to service_role;

drop policy if exists admin_audit_log_select on public.admin_audit_log;
create policy admin_audit_log_select on public.admin_audit_log for select to authenticated
  using (public.is_admin());

create or replace function public.log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can write to the audit log';
  end if;
  insert into public.admin_audit_log (actor, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end;
$$;

-- ═══ Stats ══════════════════════════════════════════════════════════════════
-- One round trip for the overview KPI tiles.

create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  select jsonb_build_object(
    'users',              (select count(*) from public.profiles),
    'onboarded',          (select count(*) from public.profiles where onboarded_at is not null),
    'verified_students',  (select count(*) from public.profiles where is_verified_student),
    'signups_7d',         (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'organisers_pending', (select count(*) from public.organisers where status = 'pending'),
    'organisers_approved',(select count(*) from public.organisers where status = 'approved'),
    'upcoming_events',    (select count(*) from public.events
                            where status = 'published' and coalesce(ends_at, starts_at) >= now()),
    'events_this_week',   (select count(*) from public.events
                            where status = 'published' and starts_at >= now()
                              and starts_at < now() + interval '7 days'),
    'needs_review',       (select count(*) from public.events
                            where needs_review and status not in ('removed', 'expired')),
    'registrations',      (select count(*) from public.registrations
                            where status not in ('cancelled', 'declined')),
    'registrations_7d',   (select count(*) from public.registrations
                            where status not in ('cancelled', 'declined')
                              and created_at >= now() - interval '7 days'),
    'check_ins',          (select count(*) from public.registrations where checked_in_at is not null)
  ) into result;
  return result;
end;
$$;

-- Sign-ups per UK calendar day for the last p_days days (zero-filled, oldest first).
create or replace function public.admin_signups_daily(p_days int default 30)
returns table (day date, signups int)
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Europe/London')::date;
  span int := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return query
    select g.d::date, coalesce(c.total, 0)::int
    from generate_series((today - (span - 1))::timestamp, today::timestamp, interval '1 day') as g(d)
    left join (
      select (p.created_at at time zone 'Europe/London')::date as uk_day, count(*) as total
      from public.profiles p
      where p.created_at >= ((today - (span - 1))::timestamp at time zone 'Europe/London')
      group by 1
    ) c on c.uk_day = g.d::date
    order by 1;
end;
$$;

revoke execute on function public.log_admin_action(text, text, text, jsonb) from public, anon;
revoke execute on function public.admin_stats() from public, anon;
revoke execute on function public.admin_signups_daily(int) from public, anon;
grant execute on function
  public.log_admin_action(text, text, text, jsonb),
  public.admin_stats(),
  public.admin_signups_daily(int)
  to authenticated, service_role;
