-- Eventbrite and Fatsoma source kinds.
-- Re-runnable: safe to apply more than once.

alter table public.event_sources drop constraint if exists event_sources_kind_check;
alter table public.event_sources
  add constraint event_sources_kind_check check (
    kind in ('ical', 'luma', 'luma-discover', 'meetup', 'meetup-search', 'eventbrite', 'fatsoma')
  );
