-- Meetup search sources flagged events as "missing from its feed" whenever they dropped out of
-- Meetup's relevance-ranked list, though they were still live. Searches no longer flag missing
-- events; clear the false flags they left. Meetup search never reports cancellations, so every
-- non-duplicate flag on these events is one of them. Possible duplicates stay in the queue.
update public.events e
set needs_review = false
from public.event_sources s
where e.source = 'source:' || s.id::text
  and s.kind = 'meetup-search'
  and e.needs_review
  and e.duplicate_of is null;
