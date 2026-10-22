-- Explore's category tabs and Interest filter show how many upcoming events each has. Counted
-- here so the page gets a few numbers instead of every event row: a recurring series counts once
-- however many dates it has, and duplicate copies aren't counted. RLS applies (security invoker).
--
-- p_interests maps each interest to the tags that count as it ({"technology": ["technology", "tech"]}),
-- so an event tagged with two synonyms of one interest still counts once.
create or replace function public.discovery_counts(p_interests jsonb default '{}'::jsonb)
returns table (kind text, key text, events bigint)
language sql stable security invoker set search_path = '' as $$
  with upcoming as (
    select coalesce(e.series_key, e.id::text) as event_key, e.category_id, e.tags
    from public.events e
    where e.status = 'published' and e.duplicate_of is null and coalesce(e.ends_at, e.starts_at) >= now()
  )
  select 'all', null, count(distinct u.event_key) from upcoming u
  union all
  select 'category', u.category_id::text, count(distinct u.event_key)
  from upcoming u where u.category_id is not null group by u.category_id
  union all
  select 'interest', i.key, count(distinct u.event_key)
  from jsonb_each(coalesce(p_interests, '{}'::jsonb)) i
  join upcoming u on u.tags && array(select jsonb_array_elements_text(i.value))
  group by i.key;
$$;

revoke execute on function public.discovery_counts(jsonb) from public, anon;
grant execute on function public.discovery_counts(jsonb) to authenticated, service_role;
