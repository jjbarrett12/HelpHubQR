-- Platform admin: allow some users to manage all tenants (customers)
alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

comment on column public.profiles.is_platform_admin is 'When true, user can access /platform-admin and manage all tenants';

-- Tenant (customer) branding and billing
alter table public.tenants
  add column if not exists logo_url text,
  add column if not exists billing_email text,
  add column if not exists billing_name text,
  add column if not exists billing_address text;

comment on column public.tenants.logo_url is 'Optional customer/company logo URL';
comment on column public.tenants.billing_email is 'Billing contact email';
comment on column public.tenants.billing_name is 'Billing contact or company name';
comment on column public.tenants.billing_address is 'Billing address';

-- Helper: is current user a platform admin?
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

-- RLS: platform admins can select/insert/update all tenants
create policy "tenants_select_platform_admin"
  on public.tenants for select
  using (
    id = public.current_tenant_id()
    or public.current_user_is_platform_admin()
  );

create policy "tenants_insert_platform_admin"
  on public.tenants for insert
  with check (public.current_user_is_platform_admin());

create policy "tenants_update_platform_admin"
  on public.tenants for update
  using (public.current_user_is_platform_admin());

-- Platform admins can select all profiles (to list users per tenant)
create policy "profiles_select_platform_admin"
  on public.profiles for select
  using (
    tenant_id = public.current_tenant_id()
    or public.current_user_is_platform_admin()
  );

-- Platform admins can update profiles (e.g. role, tenant_id) for users in any tenant
create policy "profiles_update_platform_admin"
  on public.profiles for update
  using (public.current_user_is_platform_admin());

-- Grant platform admin to an existing user (run in SQL Editor if needed):
--   update public.profiles set is_platform_admin = true where user_id = 'auth-users-uuid-here';

-- First user ever becomes platform admin (when we create the first tenant)
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
    is_first_user  -- first user gets platform admin
  );
  return new;
end;
$$;

-- Storage: allow platform admins to upload tenant logos (reuse site-logos bucket with path tenant-logos/)
-- If you use a separate bucket "tenant-logos", create it in Dashboard and add policy:
-- insert for authenticated with check (bucket_id = 'tenant-logos');
-- select for public using (bucket_id = 'tenant-logos');
-- For simplicity we use site-logos with path prefix tenant-logos/{tenant_id}/...
-- Existing policy allows authenticated upload to site-logos; path is application-controlled.
