-- Upcoming events on the admin overview count each event once: a recurring series is one event
-- however many dates it has, and a duplicate copy from a second source isn't counted. The number
-- of dates is reported separately (upcoming_dates).
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;

  select jsonb_build_object(
    'users',              (select count(*) from public.profiles),
    'onboarded',          (select count(*) from public.profiles where onboarded_at is not null),
    'verified_students',  (select count(*) from public.profiles where is_verified_student),
    'signups_7d',         (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'organisers_pending', (select count(*) from public.organisers where status = 'pending'),
    'organisers_approved',(select count(*) from public.organisers where status = 'approved'),
    'upcoming_events',    (select count(distinct coalesce(series_key, id::text)) from public.events
                            where status = 'published' and duplicate_of is null
                              and coalesce(ends_at, starts_at) >= now()),
    'upcoming_dates',     (select count(*) from public.events
                            where status = 'published' and duplicate_of is null
                              and coalesce(ends_at, starts_at) >= now()),
    'events_this_week',   (select count(distinct coalesce(series_key, id::text)) from public.events
                            where status = 'published' and duplicate_of is null and starts_at >= now()
                              and starts_at < now() + interval '7 days'),
    'needs_review',       (select count(*) from public.events
                            where needs_review and status not in ('removed', 'expired')),
    'registrations',      (select count(*) from public.registrations
                            where status not in ('cancelled', 'declined')),
    'registrations_7d',   (select count(*) from public.registrations
                            where status not in ('cancelled', 'declined')
                              and created_at >= now() - interval '7 days'),
    'check_ins',          (select count(*) from public.registrations where checked_in_at is not null)
  ) into result;
  return result;
end;
$$;
