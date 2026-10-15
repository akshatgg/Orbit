-- Notifications: web-push subscriptions, per-user reminder preferences and a send log
-- (dedupes reminders so nobody gets the same message twice). Safe to re-run.

-- ═══ Push subscriptions (one row per browser/device) ════════════════════════

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique check (endpoint ~* '^https://'),
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- A push endpoint belongs to one browser. If someone else signs in on the same browser and turns
-- push on, the subscription moves to them (holding the endpoint + keys proves it's their device).
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  result uuid;
begin
  if uid is null then
    raise exception 'Sign in to turn on notifications';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent
  returning id into result;
  return result;
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated, service_role;

-- ═══ Preferences (no row = defaults) ════════════════════════════════════════

create table if not exists public.notification_preferences (
  user_id              uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  push_enabled         boolean not null default true,
  email_enabled        boolean not null default true,
  remind_before_hours  int not null default 24 check (remind_before_hours in (2, 24)),
  deadline_reminders   boolean not null default true,
  updated_at           timestamptz not null default now()
);

drop trigger if exists notification_preferences_updated_at on public.notification_preferences;
create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;

-- ═══ Send log (server only) ═════════════════════════════════════════════════
-- kind: event_reminder | deadline_reminder | event_cancelled | event_updated:<fingerprint> |
--       registration_<status>. A row is written before sending, so the unique key stops repeats.

create table if not exists public.notification_log (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  event_id         uuid not null references public.events (id) on delete cascade,
  registration_id  uuid references public.registrations (id) on delete set null,
  kind             text not null,
  channel          text not null check (channel in ('push', 'email')),
  sent_at          timestamptz not null default now(),
  unique (user_id, event_id, kind, channel)
);

create index if not exists notification_log_event_idx on public.notification_log (event_id);

alter table public.notification_log enable row level security;
-- No policies: only the service role (cron / server senders) reads or writes the log.
revoke all on public.notification_log from anon, authenticated;
grant all on public.notification_log to service_role;
grant usage, select on sequence public.notification_log_id_seq to service_role;

-- Let the API see the new tables straight away.
notify pgrst, 'reload schema';
