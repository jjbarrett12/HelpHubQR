-- Allow tenant admins to update their own tenant (e.g. logo_url for branding).
-- Platform admins already have tenants_update_platform_admin.
create policy "tenants_update_tenant_admin"
  on public.tenants for update
  using (
    id = public.current_tenant_id()
    and (select role from public.profiles where user_id = auth.uid()) = 'admin'
  )
  with check (id = public.current_tenant_id());
