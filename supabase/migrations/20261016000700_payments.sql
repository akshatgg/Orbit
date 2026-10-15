-- Payments (Stripe Connect): webhook event log + checkout hold check.
-- Everything here is service-role only; the app reaches it through the admin client
-- after checking the user's session. Re-runnable.

-- ─── Webhook log ────────────────────────────────────────────────────────────
-- One row per Stripe event we've processed, so retried deliveries are skipped.
create table if not exists public.stripe_events (
  id          text primary key,           -- evt_…
  type        text not null,
  account     text,                       -- connected account id for Connect events
  livemode    boolean not null default false,
  received_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from public, anon, authenticated;
grant all on public.stripe_events to service_role;

-- ─── Checkout hold ──────────────────────────────────────────────────────────
-- register_for_event holds a paid spot for 30 minutes (see taken_spots). Before opening a new
-- Stripe checkout we ask: is the hold still live, or — if it lapsed — is there still room?
create or replace function public.payment_hold_ok(p_registration_id uuid)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  reg public.registrations;
begin
  select * into reg from public.registrations where id = p_registration_id;
  if reg.id is null or reg.status <> 'awaiting_payment' then
    return false;
  end if;
  if reg.updated_at > now() - interval '30 minutes' then
    return true;
  end if;
  return public.has_room(reg.event_id, reg.ticket_type_id, reg.user_id);
end;
$$;

revoke all on function public.payment_hold_ok(uuid) from public, anon, authenticated;
grant execute on function public.payment_hold_ok(uuid) to service_role;
