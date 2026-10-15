-- Organiser studio: slug checks, public follower counts and team management.
-- Profiles RLS hides other users, so team lookups go through these SECURITY DEFINER functions.
-- Re-runnable: everything is `create or replace` and grants are idempotent.

-- ─── Slug availability (pending/rejected organisers are hidden by RLS) ─────────
create or replace function public.organiser_slug_available(p_slug text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.organisers where slug = lower(trim(p_slug))
  );
$$;

-- ─── Public follower count (follows RLS only shows your own rows) ──────────────
create or replace function public.organiser_follower_count(org uuid)
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from public.follows f
  join public.organisers o on o.id = f.organiser_id
  where f.organiser_id = org
    and (o.status = 'approved' or public.is_org_member(org) or public.is_admin());
$$;

-- ─── Team: list members with their name + email ───────────────────────────────
create or replace function public.organiser_members_list(org uuid)
returns table (
  user_id    uuid,
  full_name  text,
  email      text,
  avatar_url text,
  role       text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_org_member(org) or public.is_admin()) then
    raise exception 'Only members of this organiser can see its team';
  end if;
  return query
    select m.user_id, p.full_name, p.email, p.avatar_url, m.role, m.created_at
    from public.organiser_members m
    left join public.profiles p on p.id = m.user_id
    where m.organiser_id = org
    order by (m.role = 'owner') desc, m.created_at;
end;
$$;

-- ─── Team: owner adds someone by email (or changes their role) ────────────────
create or replace function public.add_organiser_member(org uuid, member_email text, member_role text default 'editor')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
begin
  if not (public.is_org_owner(org) or public.is_admin()) then
    raise exception 'Only owners can add team members';
  end if;
  if member_role not in ('owner', 'editor') then
    raise exception 'Role must be owner or editor';
  end if;

  select id into target from public.profiles where lower(email) = lower(trim(member_email)) limit 1;
  if target is null then
    raise exception 'No ORBIT account uses %. Ask them to sign in to ORBIT once, then add them again.', trim(member_email);
  end if;

  insert into public.organiser_members (organiser_id, user_id, role)
  values (org, target, member_role)
  on conflict (organiser_id, user_id) do update set role = excluded.role;
  return target;
end;
$$;

-- ─── Team: owner removes a member (never the last owner) ──────────────────────
create or replace function public.remove_organiser_member(org uuid, member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  member_role text;
begin
  if not (public.is_org_owner(org) or public.is_admin()) then
    raise exception 'Only owners can remove team members';
  end if;

  select role into member_role from public.organiser_members where organiser_id = org and user_id = member;
  if member_role is null then
    raise exception 'That person is not on this team';
  end if;
  if member_role = 'owner' and (
    select count(*) from public.organiser_members where organiser_id = org and role = 'owner'
  ) <= 1 then
    raise exception 'Every organiser needs at least one owner';
  end if;

  delete from public.organiser_members where organiser_id = org and user_id = member;
end;
$$;

-- ─── Access ───────────────────────────────────────────────────────────────────
revoke all on function public.organiser_slug_available(text) from public, anon;
revoke all on function public.organiser_follower_count(uuid) from public;
revoke all on function public.organiser_members_list(uuid) from public, anon;
revoke all on function public.add_organiser_member(uuid, text, text) from public, anon;
revoke all on function public.remove_organiser_member(uuid, uuid) from public, anon;

grant execute on function public.organiser_slug_available(text) to authenticated;
grant execute on function public.organiser_follower_count(uuid) to anon, authenticated;
grant execute on function public.organiser_members_list(uuid) to authenticated;
grant execute on function public.add_organiser_member(uuid, text, text) to authenticated;
grant execute on function public.remove_organiser_member(uuid, uuid) to authenticated;
grant execute on function
  public.organiser_slug_available(text), public.organiser_follower_count(uuid),
  public.organiser_members_list(uuid), public.add_organiser_member(uuid, text, text),
  public.remove_organiser_member(uuid, uuid)
  to service_role;
