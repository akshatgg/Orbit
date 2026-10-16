-- The founder's account is akshatg9636@gmail.com (the earlier address had a typo).
create or replace function public.super_admin_email()
returns text language sql immutable as $$
  select 'akshatg9636@gmail.com'::text;
$$;

-- Promote the account now if it already exists; new sign-ups with this email are promoted by the
-- existing sign-up trigger.
update public.profiles set role = 'super_admin'
where lower(email) = public.super_admin_email();
