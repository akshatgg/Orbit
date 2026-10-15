-- Event page: per-ticket-type availability ("Sold out", "3 left") without exposing who registered.
-- Uses the same rules as register_for_event (taken_spots / has_room), so the page shows
-- "Join waitlist" exactly when registering would put the viewer on the waitlist.

create or replace function public.ticket_availability(p_event_id uuid)
returns table (ticket_type_id uuid, remaining int, event_remaining int)
language sql stable security definer set search_path = '' as $$
  with ev as (
    select e.id, e.capacity,
      case when e.capacity is null then null
           else greatest(0, e.capacity - public.taken_spots(e.id, null, (select auth.uid())))
      end as left_total
    from public.events e
    where e.id = p_event_id
  )
  select
    tt.id,
    case
      when tt.quantity is null then ev.left_total
      else least(
        greatest(0, tt.quantity - public.taken_spots(ev.id, tt.id, (select auth.uid()))),
        coalesce(ev.left_total, 2147483647)
      )
    end,
    ev.left_total
  from ev
  join public.ticket_types tt on tt.event_id = ev.id
  order by tt.sort_order, tt.created_at;
$$;

revoke all on function public.ticket_availability(uuid) from public;
grant execute on function public.ticket_availability(uuid) to anon, authenticated, service_role;
