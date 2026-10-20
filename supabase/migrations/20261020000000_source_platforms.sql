-- Luma and Meetup source kinds, per-event page-details tracking, and an "enriched" count per run.
-- Re-runnable: safe to apply more than once.

-- ═══ Source kinds ═══════════════════════════════════════════════════════════

alter table public.event_sources drop constraint if exists event_sources_kind_check;
alter table public.event_sources
  add constraint event_sources_kind_check check (kind in ('ical', 'luma', 'meetup'));

-- ═══ Run history: how many events got page details ══════════════════════════

alter table public.source_runs add column if not exists enriched int not null default 0;

-- ═══ Page details: one row per event whose source page was read ═════════════
-- Lets the sync read each Luma event page once instead of every night.

create table if not exists public.source_event_details (
  event_id   uuid primary key references public.events (id) on delete cascade,
  status     text not null check (status in ('ok', 'failed', 'blocked')),
  attempts   int not null default 1 check (attempts >= 0),
  last_error text check (char_length(last_error) <= 500),
  fetched_at timestamptz not null default now()
);

create index if not exists source_event_details_status_idx on public.source_event_details (status);

grant select, insert, update, delete on public.source_event_details to authenticated;
grant all on public.source_event_details to service_role;

alter table public.source_event_details enable row level security;

drop policy if exists source_event_details_admin on public.source_event_details;
create policy source_event_details_admin on public.source_event_details for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
