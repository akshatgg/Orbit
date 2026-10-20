-- Venue coordinates for event location maps.
-- Re-runnable: safe to apply more than once.

alter table public.events add column if not exists latitude double precision;
alter table public.events add column if not exists longitude double precision;

alter table public.events drop constraint if exists events_latitude_check;
alter table public.events
  add constraint events_latitude_check check (latitude is null or latitude between -90 and 90);

alter table public.events drop constraint if exists events_longitude_check;
alter table public.events
  add constraint events_longitude_check check (longitude is null or longitude between -180 and 180);
