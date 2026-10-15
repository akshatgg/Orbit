-- ORBIT core schema.
-- Users & admins, organisers, events, tickets, registrations, follows, analytics.
-- Feature-specific functions live in later migrations.

create extension if not exists pgcrypto with schema extensions;

-- ═══ Helpers ════════════════════════════════════════════════════════════════

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- True for trusted server code: the service-role key and SECURITY DEFINER functions.
create or replace function public.is_service()
returns boolean language sql stable as $$
  select current_user in ('service_role', 'postgres', 'supabase_admin');
$$;

-- ═══ Profiles ═══════════════════════════════════════════════════════════════

create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text,
  full_name             text,
  avatar_url            text,
  university            text,
  department            text,
  course                text,
  year_of_study         text,
  career_interests      text[] not null default '{}',
  personal_interests    text[] not null default '{}',
  preferred_categories  text[] not null default '{}',  -- category slugs
  preferred_formats     text[] not null default '{}'
    check (preferred_formats <@ array['in_person', 'online', 'hybrid']),
  location_preference   text,
  availability          jsonb,  -- {"mon": ["morning","evening"], ...}
  is_verified_student   boolean not null default false,
  role                  text not null default 'user'
    check (role in ('user', 'admin', 'super_admin')),
  onboarded_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (lower(email));

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'super_admin')
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'super_admin'
  );
$$;

-- The founder's account is the super admin.
create or replace function public.super_admin_email()
returns text language sql immutable as $$
  select 'akshatg9536@gmail.com'::text;
$$;

-- New sign-up → profile row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, is_verified_student, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.email ~* '\.(ac\.uk|edu)$', false),
    case when lower(new.email) = public.super_admin_email() then 'super_admin' else 'user' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users can edit their own profile, but not their role, email or verified badge.
create or replace function public.guard_profile_update()
returns trigger language plpgsql as $$
begin
  if public.is_service() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'Only the super admin can change roles (use set_user_role)';
  end if;
  if not public.is_admin() then
    new.email := old.email;
    new.is_verified_student := old.is_verified_student;
  end if;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Super admin promotes / demotes admins by email.
create or replace function public.set_user_role(target_email text, new_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles;
begin
  if not public.is_super_admin() then
    raise exception 'Only the super admin can manage admins';
  end if;
  if new_role not in ('user', 'admin') then
    raise exception 'Role must be user or admin';
  end if;

  select * into target from public.profiles where lower(email) = lower(trim(target_email));
  if target.id is null then
    raise exception 'No ORBIT account uses %. They need to sign in once first.', target_email;
  end if;
  if target.role = 'super_admin' then
    raise exception 'The super admin role cannot be changed';
  end if;

  update public.profiles set role = new_role where id = target.id;
  return target.id;
end;
$$;

-- ═══ Organisers ═════════════════════════════════════════════════════════════

create table public.organisers (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name                    text not null,
  kind                    text not null default 'society'
    check (kind in ('society', 'university', 'employer', 'community', 'other')),
  logo_url                text,
  bio                     text,
  website                 text,
  contact_email           text,
  university              text,
  status                  text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  is_verified             boolean not null default false,
  review_note             text,  -- reason shown to the organiser when rejected/suspended
  reviewed_by             uuid references auth.users (id) on delete set null,
  reviewed_at             timestamptz,
  stripe_account_id       text,
  stripe_charges_enabled  boolean not null default false,
  created_by              uuid references auth.users (id) on delete set null default auth.uid(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index organisers_status_idx on public.organisers (status);

create trigger organisers_updated_at before update on public.organisers
  for each row execute function public.set_updated_at();

create table public.organiser_members (
  organiser_id uuid not null references public.organisers (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'editor' check (role in ('owner', 'editor')),
  created_at   timestamptz not null default now(),
  primary key (organiser_id, user_id)
);

create index organiser_members_user_idx on public.organiser_members (user_id);

create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organiser_members
    where organiser_id = org and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_org_owner(org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organiser_members
    where organiser_id = org and user_id = (select auth.uid()) and role = 'owner'
  );
$$;

-- New organisers always start pending; the creator becomes the owner.
create or replace function public.guard_organiser_insert()
returns trigger language plpgsql as $$
begin
  if not (public.is_service() or public.is_admin()) then
    new.status := 'pending';
    new.is_verified := false;
    new.review_note := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.stripe_account_id := null;
    new.stripe_charges_enabled := false;
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger organisers_guard_insert before insert on public.organisers
  for each row execute function public.guard_organiser_insert();

create or replace function public.add_organiser_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by is not null then
    insert into public.organiser_members (organiser_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger organisers_add_owner after insert on public.organisers
  for each row execute function public.add_organiser_owner();

-- Members edit their profile; only admins approve/verify; only server code touches Stripe fields.
create or replace function public.guard_organiser_update()
returns trigger language plpgsql as $$
begin
  if public.is_service() then
    return new;
  end if;
  if not public.is_admin() then
    new.status := old.status;
    new.is_verified := old.is_verified;
    new.review_note := old.review_note;
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  end if;
  new.stripe_account_id := old.stripe_account_id;
  new.stripe_charges_enabled := old.stripe_charges_enabled;
  new.created_by := old.created_by;
  return new;
end;
$$;

create trigger organisers_guard_update before update on public.organisers
  for each row execute function public.guard_organiser_update();

-- ═══ Categories ═════════════════════════════════════════════════════════════

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  "group"    text not null check ("group" in ('career', 'social', 'other')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ═══ Events ═════════════════════════════════════════════════════════════════

create table public.events (
  id                    uuid primary key default gen_random_uuid(),
  organiser_id          uuid references public.organisers (id) on delete cascade,
  title                 text not null check (char_length(title) between 3 and 140),
  summary               text check (char_length(summary) <= 200),
  description           text,
  cover_url             text,
  starts_at             timestamptz not null,
  ends_at               timestamptz,
  timezone              text not null default 'Europe/London',
  format                text not null default 'in_person'
    check (format in ('in_person', 'online', 'hybrid')),
  venue_name            text,
  address               text,
  city                  text default 'London',
  category_id           uuid references public.categories (id) on delete set null,
  tags                  text[] not null default '{}',
  university            text,  -- set when aimed at one university's students

  -- How people register:
  --   tickets  → ORBIT tickets (free/paid), optional approval + questions (= application form)
  --   external → "Apply now" button redirects to external_url
  --   none     → information only
  registration_mode     text not null default 'tickets'
    check (registration_mode in ('tickets', 'external', 'none')),
  external_url          text check (external_url is null or external_url ~* '^https?://'),
  external_label        text not null default 'Apply now',
  requires_approval     boolean not null default false,
  capacity              int check (capacity is null or capacity > 0),
  waitlist_enabled      boolean not null default true,
  registration_deadline timestamptz,

  -- Display price (kept in sync from ticket_types for ORBIT tickets; set directly for external events)
  price_min             numeric(10, 2),  -- null = unknown, 0 = free
  price_max             numeric(10, 2),
  currency              text not null default 'GBP',

  status                text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled', 'expired', 'removed')),
  cancel_reason         text,
  is_featured           boolean not null default false,
  needs_review          boolean not null default false,  -- imported data that looks off
  published_at          timestamptz,

  -- Provenance: where the event came from.
  source                text not null default 'orbit',  -- orbit | manual | csv | <source id>
  source_url            text,
  source_event_id       text,
  duplicate_of          uuid references public.events (id) on delete set null,
  last_verified_at      timestamptz not null default now(),

  created_by            uuid references auth.users (id) on delete set null default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  check (ends_at is null or ends_at >= starts_at),
  check (registration_mode <> 'external' or external_url is not null),
  unique (source, source_event_id)
);

create index events_starts_at_idx on public.events (starts_at);
create index events_status_idx on public.events (status);
create index events_organiser_idx on public.events (organiser_id);
create index events_category_idx on public.events (category_id);
create index events_tags_idx on public.events using gin (tags);
-- Full-text search: use `.textSearch('search', query)` from supabase-js.
create or replace function public.event_search_text(title text, summary text, description text, tags text[])
returns text language sql immutable parallel safe as $$
  select coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(description, '') || ' ' ||
         coalesce(array_to_string(tags, ' '), '');
$$;

alter table public.events add column search tsvector generated always as (
  to_tsvector('english', public.event_search_text(title, summary, description, tags))
) stored;

create index events_search_idx on public.events using gin (search);

create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

create or replace function public.can_manage_event(ev uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1
    from public.events e
    join public.organiser_members m on m.organiser_id = e.organiser_id
    where e.id = ev and m.user_id = (select auth.uid())
  );
$$;

-- Organisers can't feature, remove or un-remove events; publishing stamps published_at.
create or replace function public.guard_event_write()
returns trigger language plpgsql as $$
begin
  if not (public.is_service() or public.is_admin()) then
    if tg_op = 'INSERT' then
      new.is_featured := false;
      new.created_by := auth.uid();
      if new.status = 'removed' then new.status := 'draft'; end if;
    else
      new.is_featured := old.is_featured;
      new.organiser_id := old.organiser_id;
      if old.status = 'removed' then new.status := 'removed'; end if;
      if new.status = 'removed' then new.status := old.status; end if;
    end if;
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create trigger events_guard before insert or update on public.events
  for each row execute function public.guard_event_write();

-- Private details (online meeting link etc.) shown only to confirmed guests and organisers.
create table public.event_private (
  event_id       uuid primary key references public.events (id) on delete cascade,
  online_url     text,
  guest_info     text,  -- e.g. door code, what to bring
  updated_at     timestamptz not null default now()
);

create trigger event_private_updated_at before update on public.event_private
  for each row execute function public.set_updated_at();

-- ═══ Tickets & registration ═════════════════════════════════════════════════

create table public.ticket_types (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  name         text not null default 'General admission',
  description  text,
  price        numeric(10, 2) not null default 0 check (price >= 0),
  currency     text not null default 'GBP',
  quantity     int check (quantity is null or quantity > 0),  -- null = limited only by event capacity
  sales_end_at timestamptz,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index ticket_types_event_idx on public.ticket_types (event_id);

-- Keep events.price_min / price_max in sync with ticket types.
create or replace function public.sync_event_price()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ev uuid := coalesce(new.event_id, old.event_id);
begin
  update public.events e
  set price_min = p.min_price, price_max = p.max_price
  from (
    select min(price) as min_price, max(price) as max_price
    from public.ticket_types where event_id = ev
  ) p
  where e.id = ev and e.registration_mode = 'tickets';
  return null;
end;
$$;

create trigger ticket_types_sync_price after insert or update or delete on public.ticket_types
  for each row execute function public.sync_event_price();

create table public.event_questions (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  label       text not null,
  kind        text not null default 'short_text'
    check (kind in ('short_text', 'long_text', 'single_select', 'multi_select', 'checkbox')),
  options     text[] not null default '{}',
  required    boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index event_questions_event_idx on public.event_questions (event_id);

-- One registration per person per event. Written only through security-definer functions.
create table public.registrations (
  id                         uuid primary key default gen_random_uuid(),
  event_id                   uuid not null references public.events (id) on delete cascade,
  user_id                    uuid not null references auth.users (id) on delete cascade,
  ticket_type_id             uuid references public.ticket_types (id) on delete set null,
  status                     text not null
    check (status in ('going', 'pending', 'waitlisted', 'awaiting_payment', 'declined', 'cancelled')),
  answers                    jsonb not null default '{}',  -- {question_id: answer}
  amount                     numeric(10, 2) not null default 0,
  currency                   text not null default 'GBP',
  payment_status             text not null default 'none'
    check (payment_status in ('none', 'pending', 'paid', 'refunded', 'failed')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id   text,
  qr_code                    text not null unique
    default encode(extensions.gen_random_bytes(12), 'hex'),
  checked_in_at              timestamptz,
  checked_in_by              uuid references auth.users (id) on delete set null,
  decided_at                 timestamptz,  -- approved/declined by organiser
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (event_id, user_id)
);

create index registrations_event_status_idx on public.registrations (event_id, status);
create index registrations_user_idx on public.registrations (user_id);

create trigger registrations_updated_at before update on public.registrations
  for each row execute function public.set_updated_at();

-- Public counts for event cards ("42 going", "3 spots left") without exposing who registered.
create or replace function public.event_counts(event_ids uuid[])
returns table (event_id uuid, going int, waitlisted int, pending int)
language sql stable security definer set search_path = '' as $$
  select
    r.event_id,
    count(*) filter (where r.status = 'going')::int,
    count(*) filter (where r.status = 'waitlisted')::int,
    count(*) filter (where r.status in ('pending', 'awaiting_payment'))::int
  from public.registrations r
  where r.event_id = any (event_ids)
  group by r.event_id;
$$;

-- ═══ Personal lists, follows, analytics ═════════════════════════════════════

create table public.user_events (
  user_id    uuid not null references auth.users (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  kind       text not null check (kind in ('saved', 'dismissed', 'external_registered', 'attended')),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id, kind)
);

create index user_events_event_idx on public.user_events (event_id);

create table public.follows (
  user_id      uuid not null references auth.users (id) on delete cascade,
  organiser_id uuid not null references public.organisers (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, organiser_id)
);

create index follows_organiser_idx on public.follows (organiser_id);

create table public.event_interactions (
  id         bigint generated always as identity primary key,
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete set null,
  kind       text not null check (kind in ('view', 'apply_click', 'share', 'calendar_add')),
  created_at timestamptz not null default now()
);

create index event_interactions_event_idx on public.event_interactions (event_id, kind);

-- ═══ Table access (explicit — "auto-expose new tables" is off) ═════════════

grant usage on schema public to anon, authenticated, service_role;

grant select, update on public.profiles to authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant select on public.organisers to anon, authenticated;
grant insert, update, delete on public.organisers to authenticated;
grant select, insert, update, delete on public.organiser_members to authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.event_private to authenticated;
grant select on public.ticket_types, public.event_questions to anon, authenticated;
grant insert, update, delete on public.ticket_types, public.event_questions to authenticated;
grant select on public.registrations to authenticated;
grant select, insert, update, delete on public.user_events, public.follows to authenticated;
grant insert on public.event_interactions to anon, authenticated;
grant select on public.event_interactions to authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

grant execute on function
  public.is_admin(), public.is_super_admin(), public.is_org_member(uuid), public.is_org_owner(uuid),
  public.can_manage_event(uuid), public.event_counts(uuid[]), public.set_user_role(text, text)
  to authenticated;
grant execute on function public.event_counts(uuid[]), public.can_manage_event(uuid) to anon;

-- ═══ Row Level Security ═════════════════════════════════════════════════════

alter table public.profiles            enable row level security;
alter table public.organisers          enable row level security;
alter table public.organiser_members   enable row level security;
alter table public.categories          enable row level security;
alter table public.events              enable row level security;
alter table public.event_private       enable row level security;
alter table public.ticket_types        enable row level security;
alter table public.event_questions     enable row level security;
alter table public.registrations       enable row level security;
alter table public.user_events         enable row level security;
alter table public.follows             enable row level security;
alter table public.event_interactions  enable row level security;

-- Profiles: yourself, admins, and organisers looking at their own guests.
create policy profiles_select on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or public.is_admin()
  or exists (
    select 1 from public.registrations r
    where r.user_id = profiles.id and public.can_manage_event(r.event_id)
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or public.is_admin());

-- Organisers: approved ones are public; members and admins see the rest.
create policy organisers_select on public.organisers for select to anon, authenticated using (
  status = 'approved'
  or created_by = (select auth.uid())
  or public.is_org_member(id)
  or public.is_admin()
);
create policy organisers_insert on public.organisers for insert to authenticated
  with check ((select auth.uid()) is not null);
create policy organisers_update on public.organisers for update to authenticated
  using (public.is_org_member(id) or public.is_admin());
create policy organisers_delete on public.organisers for delete to authenticated
  using (public.is_admin());

create policy members_select on public.organiser_members for select to authenticated using (
  user_id = (select auth.uid()) or public.is_org_member(organiser_id) or public.is_admin()
);
create policy members_write on public.organiser_members for all to authenticated
  using (public.is_org_owner(organiser_id) or public.is_admin())
  with check (public.is_org_owner(organiser_id) or public.is_admin());

-- Categories: everyone reads, admins write.
create policy categories_select on public.categories for select to anon, authenticated using (true);
create policy categories_write on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Events: published/cancelled events from approved organisers (or admin-added) are public.
create policy events_select on public.events for select to anon, authenticated using (
  (
    status in ('published', 'cancelled', 'expired')
    and (
      organiser_id is null
      or exists (select 1 from public.organisers o where o.id = organiser_id and o.status = 'approved')
    )
  )
  or public.is_org_member(organiser_id)
  or public.is_admin()
);
create policy events_insert on public.events for insert to authenticated with check (
  public.is_admin()
  or (
    organiser_id is not null
    and public.is_org_member(organiser_id)
    and exists (select 1 from public.organisers o where o.id = organiser_id and o.status = 'approved')
  )
);
create policy events_update on public.events for update to authenticated
  using (public.is_org_member(organiser_id) or public.is_admin());
create policy events_delete on public.events for delete to authenticated
  using ((public.is_org_member(organiser_id) and status = 'draft') or public.is_admin());

create policy event_private_select on public.event_private for select to authenticated using (
  public.can_manage_event(event_id)
  or exists (
    select 1 from public.registrations r
    where r.event_id = event_private.event_id and r.user_id = (select auth.uid()) and r.status = 'going'
  )
);
create policy event_private_write on public.event_private for all to authenticated
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

-- Ticket types & questions follow event visibility; organisers edit their own.
create policy ticket_types_select on public.ticket_types for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy ticket_types_write on public.ticket_types for all to authenticated
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

create policy questions_select on public.event_questions for select to anon, authenticated
  using (exists (select 1 from public.events e where e.id = event_id));
create policy questions_write on public.event_questions for all to authenticated
  using (public.can_manage_event(event_id)) with check (public.can_manage_event(event_id));

-- Registrations: your own, or the organiser's guest list. Writes go through functions.
create policy registrations_select on public.registrations for select to authenticated using (
  user_id = (select auth.uid()) or public.can_manage_event(event_id)
);

-- Personal lists and follows: your own only.
create policy user_events_own on public.user_events for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy follows_own on public.follows for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Analytics: anyone logs an interaction (as themselves); organisers/admins read their events'.
create policy interactions_insert on public.event_interactions for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
create policy interactions_select on public.event_interactions for select to authenticated
  using (public.can_manage_event(event_id));

-- ═══ Storage: event covers & organiser logos ════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('event-covers', 'event-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('organiser-logos', 'organiser-logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Uploads go to a folder named after the uploader's user id: <bucket>/<user_id>/<file>
create policy "Upload own images" on storage.objects for insert to authenticated with check (
  bucket_id in ('event-covers', 'organiser-logos')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "Update own images" on storage.objects for update to authenticated using (
  bucket_id in ('event-covers', 'organiser-logos')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "Delete own images" on storage.objects for delete to authenticated using (
  bucket_id in ('event-covers', 'organiser-logos')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- If the founder signed up before this migration ran, make them super admin now.
update public.profiles set role = 'super_admin'
where lower(email) = public.super_admin_email();
