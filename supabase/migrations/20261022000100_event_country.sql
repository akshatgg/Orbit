-- The country an event is in (ISO 3166 alpha-2, e.g. GB, IN), for the Explore Location filter.
-- Imports fill it from the platform (Meetup, Luma, Eventbrite, Fatsoma). Events that only have a
-- city get their country from ORBIT's list of known cities when the filter is built
-- (src/lib/places.ts), so it stays empty for them.

alter table public.events
  add column if not exists country text check (country ~ '^[A-Z]{2}$');

comment on column public.events.country is 'ISO 3166 alpha-2 country code from the source platform (null when unknown; known cities are matched in app code).';

create index if not exists events_country_city_idx on public.events (country, city) where status = 'published';

-- Addresses that already end in their country.
update public.events set country = 'GB'
where country is null and address ~* ',\s*(uk|united kingdom)\s*$';
update public.events set country = 'IN'
where country is null and address ~* ',\s*india\s*$';
