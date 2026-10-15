-- Approved event sources (iCal feeds today, other kinds later), their run history,
-- and admin decisions about possible duplicates.
-- Re-runnable: safe to apply more than once.

-- ═══ Sources ════════════════════════════════════════════════════════════════

create table if not exists public.event_sources (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (char_length(trim(name)) between 2 and 80),
  kind                 text not null default 'ical' check (kind in ('ical')),
  url                  text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  default_organiser_id uuid references public.organisers (id) on delete set null,
  default_category_id  uuid references public.categories (id) on delete set null,
  default_tags         text[] not null default '{}',
  attribution          text check (char_length(attribution) <= 200),
  -- Compliance: who granted permission / which terms were checked.
  permission_confirmed boolean not null default false,
  permission_note      text check (char_length(permission_note) <= 1000),
  enabled              boolean not null default false,
  last_run_at          timestamptz,
  last_status          text check (last_status in ('ok', 'error')),
  last_error           text,
  created_by           uuid references auth.users (id) on delete set null default auth.uid(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- A feed can only be switched on once someone has confirmed (and noted) permission.
  constraint event_sources_enabled_needs_permission check (
    not enabled or (permission_confirmed and char_length(trim(coalesce(permission_note, ''))) > 0)
  ),
  constraint event_sources_kind_url_key unique (kind, url)
);

create index if not exists event_sources_enabled_idx on public.event_sources (enabled);

drop trigger if exists event_sources_updated_at on public.event_sources;
create trigger event_sources_updated_at before update on public.event_sources
  for each row execute function public.set_updated_at();

-- ═══ Run history ════════════════════════════════════════════════════════════

create table if not exists public.source_runs (
  id              uuid primary key default gen_random_uuid(),
  source_id       uuid not null references public.event_sources (id) on delete cascade,
  trigger         text not null default 'cron' check (trigger in ('cron', 'manual')),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null check (status in ('ok', 'error')),
  found           int not null default 0,
  inserted        int not null default 0,
  updated         int not null default 0,
  unchanged       int not null default 0,
  flagged_missing int not null default 0,
  errors          jsonb not null default '[]'::jsonb
);

create index if not exists source_runs_source_idx on public.source_runs (source_id, started_at desc);
create index if not exists source_runs_started_idx on public.source_runs (started_at desc);

-- ═══ "Not a duplicate" decisions ════════════════════════════════════════════
-- Stops the nightly duplicate check from flagging the same pair again.

create table if not exists public.event_duplicate_dismissals (
  event_id       uuid not null references public.events (id) on delete cascade,
  other_event_id uuid not null references public.events (id) on delete cascade,
  dismissed_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  primary key (event_id, other_event_id),
  check (event_id < other_event_id)
);

create index if not exists event_duplicate_dismissals_other_idx
  on public.event_duplicate_dismissals (other_event_id);

-- Review queue lookups.
create index if not exists events_review_idx on public.events (needs_review) where needs_review;
create index if not exists events_duplicate_of_idx on public.events (duplicate_of) where duplicate_of is not null;

-- ═══ Table access ═══════════════════════════════════════════════════════════

grant select, insert, update, delete on public.event_sources to authenticated;
grant select, insert, update, delete on public.source_runs to authenticated;
grant select, insert, update, delete on public.event_duplicate_dismissals to authenticated;
grant all on public.event_sources, public.source_runs, public.event_duplicate_dismissals to service_role;

-- ═══ Row Level Security: admins only (the service role bypasses RLS) ════════

alter table public.event_sources              enable row level security;
alter table public.source_runs                enable row level security;
alter table public.event_duplicate_dismissals enable row level security;

drop policy if exists event_sources_admin on public.event_sources;
create policy event_sources_admin on public.event_sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists source_runs_admin on public.source_runs;
create policy source_runs_admin on public.source_runs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists event_duplicate_dismissals_admin on public.event_duplicate_dismissals;
create policy event_duplicate_dismissals_admin on public.event_duplicate_dismissals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
