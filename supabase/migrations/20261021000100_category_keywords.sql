-- Category keywords for auto-classification, and the per-source switch that turns it on.
--
-- Imported discovery events arrive with no category of their own. Rather than dumping a whole
-- Meetup search or Luma city page into one tile, each category can list keywords and the import
-- scores an event's title/tags/prose against them. Words are matched whole ("run" does not match
-- "running"), lowercased, and the classifier only answers when one category clearly wins.

alter table public.categories
  add column if not exists keywords text[] not null default '{}';

-- Starter vocabulary for the default categories. Only fills categories that have none, so an
-- admin's own keywords are never overwritten.
update public.categories as c
set keywords = v.keywords
from (values
  ('employer-presentation', array['employer presentation','employer','graduate scheme','recruiter','company talk','careers talk']),
  ('careers-fair',          array['careers fair','career fair','jobs fair','recruitment fair','graduate fair']),
  ('workshop',              array['workshop','masterclass','bootcamp','training','hands on','tutorial']),
  ('competition',           array['competition','hackathon','case competition','challenge','pitch contest','case study']),
  ('talk',                  array['talk','panel','discussion','lecture','speaker','fireside','keynote','debate','conversation']),
  ('networking',            array['networking','mixer','meet and greet','speed networking','connect']),
  ('society',               array['society','student union','committee','agm','members night']),
  ('social',                array['social','party','drinks','pub','games night','quiz','karaoke','board games']),
  ('fitness',               array['fitness','sport','run','running','football','basketball','yoga','climbing','hike','hiking','gym','swim','pilates']),
  ('entrepreneurship',      array['entrepreneur','startup','founder','venture capital','incubator','accelerator','pitch night']),
  ('sustainability',        array['sustainability','climate','green','environment','esg','net zero','renewable','circular']),
  ('arts-culture',          array['arts','culture','music','theatre','theater','exhibition','gallery','poetry','film','cinema'])
) as v(slug, keywords)
where c.slug = v.slug and cardinality(c.keywords) = 0;

alter table public.event_sources
  add column if not exists auto_category boolean not null default false;

-- Group feeds keep their one default category; discovery feeds pull unrelated events and start
-- with classification on. Admins can turn it off again on the source form.
update public.event_sources
set auto_category = true
where kind in ('luma-discover', 'meetup-search');
