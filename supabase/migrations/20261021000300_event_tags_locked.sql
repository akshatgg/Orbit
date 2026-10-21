-- Imported events get interest tags automatically on every sync (only ever added). Once an admin
-- edits an event's tags by hand, those tags are final: syncs stop adding to them, so an interest
-- the admin removed doesn't come back.

alter table public.events
  add column if not exists tags_locked boolean not null default false;

comment on column public.events.tags_locked is 'Set when an admin edits the tags; automatic interest tagging then leaves the event alone.';
