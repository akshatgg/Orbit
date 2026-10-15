-- ORBIT core schema (piece 1): profiles, categories, events, user_events.

-- ─── Helpers ────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Profiles ───────────────────────────────────────────────
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  full_name             text,
  university            text,
  department            text,
  course                text,
  year_of_study         text,
  career_interests      text[] not null default '{}',
  personal_interests    text[] not null default '{}',
  preferred_event_types text[] not null default '{}',
  preferred_formats     text[] not null default '{}'
    check (preferred_formats <@ array['in_person', 'online', 'hybrid']),
  location_preference   text,
  availability          jsonb,            -- e.g. {"mon": ["evening"], "sat": ["day"]}
  is_verified_student   boolean not null default false,
  role                  text not null default 'student' check (role in ('student', 'admin')),
  onboarded_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- New sign-up → profile row. University emails get the verified badge.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, is_verified_student)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.email ~* '\.(ac\.uk|edu)$', false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- ─── Categories ─────────────────────────────────────────────
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  "group"    text not null check ("group" in ('career', 'social', 'other')),
  created_at timestamptz not null default now()
);

-- ─── Events ─────────────────────────────────────────────────
create table public.events (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  description           text,
  starts_at             timestamptz not null,
  ends_at               timestamptz,
  format                text not null default 'in_person'
    check (format in ('in_person', 'online', 'hybrid')),
  venue                 text,
  online_url            text,
  organiser             text,
  category_id           uuid references public.categories (id) on delete set null,
  tags                  text[] not null default '{}',
  price_min             numeric(10, 2),   -- null = unknown, 0 = free
  price_max             numeric(10, 2),
  currency              text not null default 'GBP',
  registration_deadline timestamptz,
  registration_url      text,
  availability          text not null default 'unknown'
    check (availability in ('available', 'limited', 'full', 'unknown')),
  status                text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'expired', 'unverified')),
  -- Provenance: every event keeps where it came from.
  source                text not null default 'manual',  -- manual | csv | <connector id>
  source_url            text,
  source_event_id       text,
  last_verified_at      timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (source, source_event_id)
);

create index events_starts_at_idx on public.events (starts_at);
create index events_status_idx on public.events (status);
create index events_tags_idx on public.events using gin (tags);
create index events_search_idx on public.events using gin (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(organiser, '') || ' ' || coalesce(description, ''))
);

create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- ─── What each user did with each event ─────────────────────
create table public.user_events (
  user_id    uuid not null references auth.users (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  status     text not null check (status in ('saved', 'registered', 'attended', 'dismissed')),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id, status)
);

create index user_events_event_idx on public.user_events (event_id);

-- ─── Table access (explicit — "auto-expose new tables" is off) ─
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.user_events to authenticated;
grant all on public.profiles, public.categories, public.events, public.user_events to service_role;
grant execute on function public.is_admin() to authenticated;

-- ─── Row Level Security ─────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.categories  enable row level security;
alter table public.events      enable row level security;
alter table public.user_events enable row level security;

create policy "Read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "Update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()));

-- Students can't promote themselves or fake the verified badge.
revoke update on public.profiles from authenticated;
grant update (
  full_name, university, department, course, year_of_study,
  career_interests, personal_interests, preferred_event_types, preferred_formats,
  location_preference, availability, onboarded_at
) on public.profiles to authenticated;

create policy "Anyone signed in reads categories" on public.categories
  for select to authenticated using (true);
create policy "Admins manage categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Anyone signed in reads events" on public.events
  for select to authenticated using (true);
create policy "Admins manage events" on public.events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users manage their own event actions" on public.user_events
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
