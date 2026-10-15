-- Registration rules: tickets, approvals, waitlist, payments hand-off, check-in.
-- All writes to public.registrations go through these functions (RLS allows no direct writes).

-- Spots currently taken: going + awaiting approval + unpaid checkouts younger than 30 minutes.
create or replace function public.taken_spots(p_event_id uuid, p_ticket_type_id uuid default null, p_exclude_user uuid default null)
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from public.registrations r
  where r.event_id = p_event_id
    and (p_ticket_type_id is null or r.ticket_type_id = p_ticket_type_id)
    and (p_exclude_user is null or r.user_id <> p_exclude_user)
    and (
      r.status in ('going', 'pending')
      or (r.status = 'awaiting_payment' and r.updated_at > now() - interval '30 minutes')
    );
$$;

-- Is there room for one more on this event (and this ticket type)?
create or replace function public.has_room(p_event_id uuid, p_ticket_type_id uuid, p_exclude_user uuid default null)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  cap int;
  qty int;
begin
  select capacity into cap from public.events where id = p_event_id;
  select quantity into qty from public.ticket_types where id = p_ticket_type_id;
  if cap is not null and public.taken_spots(p_event_id, null, p_exclude_user) >= cap then
    return false;
  end if;
  if qty is not null and public.taken_spots(p_event_id, p_ticket_type_id, p_exclude_user) >= qty then
    return false;
  end if;
  return true;
end;
$$;

-- ─── Register ───────────────────────────────────────────────────────────────
-- Free → going. Paid → awaiting_payment (app then opens checkout). Approval on → pending.
-- Full → waitlisted (if the waitlist is on). Re-registering after cancelling reuses the row.
create or replace function public.register_for_event(
  p_event_id uuid,
  p_ticket_type_id uuid default null,
  p_answers jsonb default '{}'::jsonb
)
returns public.registrations
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ev public.events;
  tt public.ticket_types;
  existing public.registrations;
  q record;
  new_status text;
  result public.registrations;
begin
  if uid is null then
    raise exception 'Sign in to register';
  end if;

  select * into ev from public.events where id = p_event_id for update;
  if ev.id is null or ev.status <> 'published'
     or (ev.organiser_id is not null and not exists (
       select 1 from public.organisers o where o.id = ev.organiser_id and o.status = 'approved')) then
    raise exception 'This event is not open for registration';
  end if;
  if ev.registration_mode <> 'tickets' then
    raise exception 'This event takes registrations on the organiser''s own site';
  end if;
  if coalesce(ev.ends_at, ev.starts_at) < now() then
    raise exception 'This event has already ended';
  end if;
  if ev.registration_deadline is not null and ev.registration_deadline < now() then
    raise exception 'Registration has closed';
  end if;

  if p_ticket_type_id is null then
    select * into tt from public.ticket_types where event_id = ev.id order by sort_order, created_at limit 1;
  else
    select * into tt from public.ticket_types where id = p_ticket_type_id and event_id = ev.id;
  end if;
  if tt.id is null then
    raise exception 'Choose a valid ticket';
  end if;
  if tt.sales_end_at is not null and tt.sales_end_at < now() then
    raise exception 'Sales for this ticket have ended';
  end if;

  for q in select id, label from public.event_questions where event_id = ev.id and required loop
    if coalesce(trim(both from p_answers ->> q.id::text), '') in ('', '[]', 'false') then
      raise exception 'Please answer: %', q.label;
    end if;
  end loop;

  select * into existing from public.registrations where event_id = ev.id and user_id = uid;
  if existing.id is not null and existing.status not in ('cancelled') then
    if existing.status = 'declined' then
      raise exception 'The organiser didn''t accept your registration for this event';
    end if;
    return existing;  -- already registered: idempotent
  end if;

  if not public.has_room(ev.id, tt.id, uid) then
    if ev.waitlist_enabled then
      new_status := 'waitlisted';
    else
      raise exception 'This event is full';
    end if;
  elsif ev.requires_approval then
    new_status := 'pending';
  elsif tt.price > 0 then
    new_status := 'awaiting_payment';
  else
    new_status := 'going';
  end if;

  if existing.id is not null then
    update public.registrations set
      ticket_type_id = tt.id, status = new_status, answers = coalesce(p_answers, '{}'::jsonb),
      amount = tt.price, currency = tt.currency,
      payment_status = case when tt.price > 0 then 'pending' else 'none' end,
      stripe_checkout_session_id = null, checked_in_at = null, checked_in_by = null, decided_at = null
    where id = existing.id
    returning * into result;
  else
    insert into public.registrations (event_id, user_id, ticket_type_id, status, answers, amount, currency, payment_status)
    values (ev.id, uid, tt.id, new_status, coalesce(p_answers, '{}'::jsonb), tt.price, tt.currency,
            case when tt.price > 0 then 'pending' else 'none' end)
    returning * into result;
  end if;

  return result;
end;
$$;

-- ─── Waitlist ───────────────────────────────────────────────────────────────
-- Moves people off the waitlist (oldest first) while there is room. Returns who moved.
create or replace function public.promote_waitlist(p_event_id uuid)
returns setof public.registrations
language plpgsql security definer set search_path = '' as $$
declare
  ev public.events;
  w public.registrations;
  price numeric;
begin
  select * into ev from public.events where id = p_event_id for update;
  if ev.id is null or ev.status <> 'published' then
    return;
  end if;
  for w in
    select * from public.registrations
    where event_id = p_event_id and status = 'waitlisted'
    order by created_at
  loop
    exit when not public.has_room(p_event_id, w.ticket_type_id, w.user_id);
    select tt.price into price from public.ticket_types tt where tt.id = w.ticket_type_id;
    update public.registrations set
      status = case
        when ev.requires_approval then 'pending'
        when coalesce(price, 0) > 0 then 'awaiting_payment'
        else 'going' end
    where id = w.id
    returning * into w;
    return next w;
  end loop;
end;
$$;

-- ─── Cancel (by the attendee) ───────────────────────────────────────────────
create or replace function public.cancel_registration(p_event_id uuid)
returns public.registrations
language plpgsql security definer set search_path = '' as $$
declare
  result public.registrations;
begin
  update public.registrations set status = 'cancelled', checked_in_at = null
  where event_id = p_event_id and user_id = auth.uid() and status <> 'cancelled'
  returning * into result;
  if result.id is null then
    raise exception 'You are not registered for this event';
  end if;
  perform public.promote_waitlist(p_event_id);
  return result;
end;
$$;

-- ─── Approve / decline (by the organiser) ───────────────────────────────────
create or replace function public.decide_registration(p_registration_id uuid, p_decision text)
returns public.registrations
language plpgsql security definer set search_path = '' as $$
declare
  reg public.registrations;
  price numeric;
  result public.registrations;
begin
  select * into reg from public.registrations where id = p_registration_id;
  if reg.id is null or not public.can_manage_event(reg.event_id) then
    raise exception 'Registration not found';
  end if;
  if p_decision not in ('approve', 'decline') then
    raise exception 'Decision must be approve or decline';
  end if;

  if p_decision = 'decline' then
    update public.registrations set status = 'declined', decided_at = now()
    where id = reg.id returning * into result;
    perform public.promote_waitlist(reg.event_id);
    return result;
  end if;

  if reg.status not in ('pending', 'waitlisted', 'declined') then
    return reg;  -- already approved
  end if;
  -- Approving from the waitlist/declined needs a free spot; a pending person already holds one.
  if reg.status <> 'pending' and not public.has_room(reg.event_id, reg.ticket_type_id, reg.user_id) then
    raise exception 'The event is full. Increase the capacity to approve more people.';
  end if;
  select tt.price into price from public.ticket_types tt where tt.id = reg.ticket_type_id;
  update public.registrations set
    status = case when coalesce(price, 0) > 0 and reg.payment_status <> 'paid' then 'awaiting_payment' else 'going' end,
    decided_at = now()
  where id = reg.id returning * into result;
  return result;
end;
$$;

-- ─── Check-in at the door (organiser scans the QR code) ─────────────────────
create or replace function public.check_in(p_event_id uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  reg public.registrations;
  guest_name text;
  ticket_name text;
begin
  if not public.can_manage_event(p_event_id) then
    raise exception 'You can''t check guests in for this event';
  end if;

  select * into reg from public.registrations
  where event_id = p_event_id and qr_code = lower(trim(p_code));
  if reg.id is null then
    return jsonb_build_object('result', 'not_found');
  end if;

  select coalesce(full_name, email) into guest_name from public.profiles where id = reg.user_id;
  select name into ticket_name from public.ticket_types where id = reg.ticket_type_id;

  if reg.status <> 'going' then
    return jsonb_build_object('result', 'not_going', 'status', reg.status, 'name', guest_name, 'ticket', ticket_name);
  end if;
  if reg.checked_in_at is not null then
    return jsonb_build_object('result', 'already', 'name', guest_name, 'ticket', ticket_name,
                              'checked_in_at', reg.checked_in_at, 'registration_id', reg.id);
  end if;

  update public.registrations set checked_in_at = now(), checked_in_by = auth.uid() where id = reg.id;
  return jsonb_build_object('result', 'checked_in', 'name', guest_name, 'ticket', ticket_name, 'registration_id', reg.id);
end;
$$;

create or replace function public.undo_check_in(p_registration_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ev uuid;
begin
  select event_id into ev from public.registrations where id = p_registration_id;
  if ev is null or not public.can_manage_event(ev) then
    raise exception 'Registration not found';
  end if;
  update public.registrations set checked_in_at = null, checked_in_by = null where id = p_registration_id;
end;
$$;

-- ─── Payments hand-off (server only — called by the payment webhook) ────────
create or replace function public.mark_registration_paid(
  p_registration_id uuid, p_checkout_session_id text, p_payment_intent_id text
)
returns public.registrations
language plpgsql security definer set search_path = '' as $$
declare
  result public.registrations;
begin
  update public.registrations set
    status = 'going', payment_status = 'paid',
    stripe_checkout_session_id = p_checkout_session_id,
    stripe_payment_intent_id = p_payment_intent_id
  where id = p_registration_id and status in ('awaiting_payment', 'cancelled', 'waitlisted')
  returning * into result;
  return result;
end;
$$;

revoke all on function public.mark_registration_paid(uuid, text, text) from public, anon, authenticated;
grant execute on function public.mark_registration_paid(uuid, text, text) to service_role;

revoke all on function public.taken_spots(uuid, uuid, uuid), public.has_room(uuid, uuid, uuid),
  public.promote_waitlist(uuid) from public, anon, authenticated;

grant execute on function
  public.register_for_event(uuid, uuid, jsonb),
  public.cancel_registration(uuid),
  public.decide_registration(uuid, text),
  public.check_in(uuid, text),
  public.undo_check_in(uuid)
  to authenticated;
grant execute on function public.promote_waitlist(uuid) to service_role;
