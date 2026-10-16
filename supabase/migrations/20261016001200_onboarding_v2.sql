-- Onboarding v2: sign-up goals + "which describes you" fields on profiles, and organiser team invites.
-- Re-runnable: columns/tables use IF NOT EXISTS, constraints are dropped and re-added, functions are
-- `create or replace`, policies are dropped first.

-- ═══ Profiles: goals and user type ══════════════════════════════════════════

alter table public.profiles
  add column if not exists goals           text[] not null default '{}',
  add column if not exists user_type       text,
  add column if not exists graduation_year int,
  add column if not exists company         text,
  add column if not exists industry        text,
  add column if not exists job_title       text,
  add column if not exists host_role       text;

alter table public.profiles drop constraint if exists profiles_goals_check;
alter table public.profiles add constraint profiles_goals_check
  check (goals <@ array['career', 'network', 'social', 'host']);

alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles add constraint profiles_user_type_check
  check (user_type is null or user_type in ('student', 'graduate', 'professional', 'other'));

alter table public.profiles drop constraint if exists profiles_graduation_year_check;
alter table public.profiles add constraint profiles_graduation_year_check
  check (graduation_year is null or graduation_year between 1950 and 2100);

-- ═══ Organiser team invites ═════════════════════════════════════════════════

create table if not exists public.organiser_invites (
  id           uuid primary key default gen_random_uuid(),
  organiser_id uuid not null references public.organisers (id) on delete cascade,
  code         text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 20),
  role         text not null default 'editor' check (role in ('owner', 'editor')),
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  expires_at   timestamptz not null default now() + interval '14 days',
  max_uses     int not null default 25 check (max_uses > 0),
  uses         int not null default 0 check (uses >= 0),
  revoked      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists organiser_invites_org_idx on public.organiser_invites (organiser_id);

alter table public.organiser_invites enable row level security;

-- Only owners (and admins) of the organisation see or manage its invites. Nobody else reads them;
-- joining goes through the SECURITY DEFINER functions below.
drop policy if exists organiser_invites_manage on public.organiser_invites;
create policy organiser_invites_manage on public.organiser_invites for all to authenticated
  using (public.is_org_owner(organiser_id) or public.is_admin())
  with check (public.is_org_owner(organiser_id) or public.is_admin());

revoke all on public.organiser_invites from anon, authenticated;
grant select, delete on public.organiser_invites to authenticated;
grant update (revoked) on public.organiser_invites to authenticated;
grant all on public.organiser_invites to service_role;

-- Owner/admin creates an invite link for an APPROVED organisation. Returns the code.
create or replace function public.create_organiser_invite(org uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  status_now text;
  new_code   text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to create an invite';
  end if;
  if not (public.is_org_owner(org) or public.is_admin()) then
    raise exception 'Only owners can create team invites';
  end if;
  select status into status_now from public.organisers where id = org;
  if status_now is null then
    raise exception 'Organiser not found';
  end if;
  if status_now <> 'approved' then
    raise exception 'Team invites unlock once your organisation is approved';
  end if;

  insert into public.organiser_invites (organiser_id, created_by)
  values (org, (select auth.uid()))
  returning code into new_code;
  return new_code;
end;
$$;

-- What the /join page needs to render, for a signed-in person holding a code.
-- Returns no row for unknown codes. The page works out the human message from these fields.
create or replace function public.peek_organiser_invite(p_code text)
returns table (
  organiser_id   uuid,
  organiser_name text,
  organiser_slug text,
  logo_url       text,
  org_status     text,
  role           text,
  expires_at     timestamptz,
  max_uses       int,
  uses           int,
  revoked        boolean,
  already_member boolean
)
language sql stable security definer set search_path = '' as $$
  select o.id, o.name, o.slug, o.logo_url, o.status, i.role, i.expires_at, i.max_uses, i.uses, i.revoked,
         exists (select 1 from public.organiser_members m where m.organiser_id = o.id and m.user_id = (select auth.uid()))
  from public.organiser_invites i
  join public.organisers o on o.id = i.organiser_id
  where i.code = trim(p_code)
    and (select auth.uid()) is not null;
$$;

-- Signed-in person accepts an invite and becomes a team member. Returns the organiser.
create or replace function public.accept_organiser_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  inv      public.organiser_invites;
  org      public.organisers;
  inserted int;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to join a team';
  end if;

  select * into inv from public.organiser_invites where code = trim(p_code) for update;
  if inv.id is null then
    raise exception 'This invite link is not valid';
  end if;
  if inv.revoked then
    raise exception 'This invite link has been turned off';
  end if;
  if inv.expires_at <= now() then
    raise exception 'This invite link has expired';
  end if;
  if inv.uses >= inv.max_uses then
    raise exception 'This invite link has reached its limit';
  end if;

  select * into org from public.organisers where id = inv.organiser_id;
  if org.status <> 'approved' then
    raise exception 'This organisation is not accepting team members right now';
  end if;

  insert into public.organiser_members (organiser_id, user_id, role)
  values (inv.organiser_id, (select auth.uid()), inv.role)
  on conflict (organiser_id, user_id) do nothing;
  get diagnostics inserted = row_count;

  if inserted > 0 then
    update public.organiser_invites set uses = uses + 1 where id = inv.id;
  end if;

  return jsonb_build_object('id', org.id, 'slug', org.slug, 'name', org.name, 'joined', inserted > 0);
end;
$$;

revoke all on function public.create_organiser_invite(uuid) from public, anon;
revoke all on function public.peek_organiser_invite(text) from public, anon;
revoke all on function public.accept_organiser_invite(text) from public, anon;
grant execute on function public.create_organiser_invite(uuid) to authenticated, service_role;
grant execute on function public.peek_organiser_invite(text) to authenticated, service_role;
grant execute on function public.accept_organiser_invite(text) to authenticated, service_role;
