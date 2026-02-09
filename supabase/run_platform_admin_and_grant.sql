-- Run this ENTIRE script once in Supabase Dashboard → SQL Editor.
-- It adds the platform admin column + policies, then grants admin to jjbarrett12@gmail.com.
-- If you get "policy already exists" on a second run, run only the last block (the UPDATE).

-- 1. Add column and tenant billing columns
alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

alter table public.tenants
  add column if not exists logo_url text,
  add column if not exists billing_email text,
  add column if not exists billing_name text,
  add column if not exists billing_address text;

-- 2. Helper function
create or replace function public.current_user_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where user_id = auth.uid()),
    false
  );
$$;

-- 3. RLS policies (may error with "already exists" if you ran this before – then just run the UPDATE at the end)
drop policy if exists "tenants_select_platform_admin" on public.tenants;
create policy "tenants_select_platform_admin"
  on public.tenants for select
  using (
    id = public.current_tenant_id()
    or public.current_user_is_platform_admin()
  );

drop policy if exists "tenants_insert_platform_admin" on public.tenants;
create policy "tenants_insert_platform_admin"
  on public.tenants for insert
  with check (public.current_user_is_platform_admin());

drop policy if exists "tenants_update_platform_admin" on public.tenants;
create policy "tenants_update_platform_admin"
  on public.tenants for update
  using (public.current_user_is_platform_admin());

drop policy if exists "profiles_select_platform_admin" on public.profiles;
create policy "profiles_select_platform_admin"
  on public.profiles for select
  using (
    tenant_id = public.current_tenant_id()
    or public.current_user_is_platform_admin()
  );

drop policy if exists "profiles_update_platform_admin" on public.profiles;
create policy "profiles_update_platform_admin"
  on public.profiles for update
  using (public.current_user_is_platform_admin());

-- 4. Update trigger so first user gets platform admin
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_tenant_id uuid;
  is_first_user boolean;
begin
  select count(*) = 0 into is_first_user from public.profiles;
  select id into first_tenant_id from public.tenants limit 1;
  if first_tenant_id is null then
    insert into public.tenants (name) values ('Default Tenant');
    first_tenant_id := (select id from public.tenants limit 1);
  end if;
  insert into public.profiles (user_id, tenant_id, role, is_platform_admin)
  values (
    new.id,
    first_tenant_id,
    'admin',
    is_first_user
  );
  return new;
end;
$$;

-- 5. Grant platform admin to jjbarrett12@gmail.com
update public.profiles
set is_platform_admin = true
where user_id = (select id from auth.users where email = 'jjbarrett12@gmail.com' limit 1);
