-- Recurring series (e.g. a Meetup that runs every Wednesday). Each date stays its own event — with
-- its own registration link, reminders and calendar entry — and dates of one series share a key.
-- Discovery shows only a series' next date; the event page lists all of its dates.

alter table public.events
  add column if not exists series_key text,
  add column if not exists series_label text;

comment on column public.events.series_key is 'Shared by every date of one recurring series (null for one-off events).';
comment on column public.events.series_label is 'How the series repeats, as the source words it, e.g. "Every week on Wednesday until December 10, 2026".';

create index if not exists events_series_key_idx on public.events (series_key, starts_at) where series_key is not null;
