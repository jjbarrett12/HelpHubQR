-- RLS: enable on all app tables
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.rooms enable row level security;
alter table public.room_tokens enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_events enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.alert_rules enable row level security;

-- Helper: get current user's tenant_id from profiles
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where user_id = auth.uid();
$$;

-- Tenants: only own tenant (admin/manager creation handled by service role or admin UI with checks)
create policy "tenant_select_own"
  on public.tenants for select
  using (id = public.current_tenant_id());

-- Profiles: users see only profiles in their tenant
create policy "profiles_select_tenant"
  on public.profiles for select
  using (tenant_id = public.current_tenant_id());

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (user_id = auth.uid());

-- Sites: staff can only read/update sites for their tenant
create policy "sites_select_tenant"
  on public.sites for select
  using (tenant_id = public.current_tenant_id());

create policy "sites_all_tenant"
  on public.sites for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Rooms: staff can read rooms for their tenant's sites
create policy "rooms_select_tenant"
  on public.rooms for select
  using (
    site_id in (select id from public.sites where tenant_id = public.current_tenant_id())
  );

create policy "rooms_all_tenant"
  on public.rooms for all
  using (
    site_id in (select id from public.sites where tenant_id = public.current_tenant_id())
  );

-- Room tokens: same as rooms (needed for admin QR export; staff don't need to edit tokens)
create policy "room_tokens_select_tenant"
  on public.room_tokens for select
  using (
    room_id in (
      select r.id from public.rooms r
      join public.sites s on s.id = r.site_id
      where s.tenant_id = public.current_tenant_id()
    )
  );

create policy "room_tokens_all_tenant"
  on public.room_tokens for all
  using (
    room_id in (
      select r.id from public.rooms r
      join public.sites s on s.id = r.site_id
      where s.tenant_id = public.current_tenant_id()
    )
  );

-- Tickets: staff can select/update only their tenant's tickets
create policy "tickets_select_tenant"
  on public.tickets for select
  using (tenant_id = public.current_tenant_id());

create policy "tickets_update_tenant"
  on public.tickets for update
  using (tenant_id = public.current_tenant_id());

-- Ticket events: read/insert for tickets in tenant
create policy "ticket_events_select_tenant"
  on public.ticket_events for select
  using (
    ticket_id in (select id from public.tickets where tenant_id = public.current_tenant_id())
  );

create policy "ticket_events_insert_tenant"
  on public.ticket_events for insert
  with check (
    ticket_id in (select id from public.tickets where tenant_id = public.current_tenant_id())
  );

-- Ticket attachments: same
create policy "ticket_attachments_select_tenant"
  on public.ticket_attachments for select
  using (
    ticket_id in (select id from public.tickets where tenant_id = public.current_tenant_id())
  );

create policy "ticket_attachments_insert_tenant"
  on public.ticket_attachments for insert
  with check (
    ticket_id in (select id from public.tickets where tenant_id = public.current_tenant_id())
  );

-- Alert rules: per site / tenant
create policy "alert_rules_select_tenant"
  on public.alert_rules for select
  using (
    site_id in (select id from public.sites where tenant_id = public.current_tenant_id())
  );

create policy "alert_rules_all_tenant"
  on public.alert_rules for all
  using (
    site_id in (select id from public.sites where tenant_id = public.current_tenant_id())
  );

-- Trigger: create profile on signup (link to tenant; admin must set tenant_id or use default tenant)
-- We create a default tenant and assign first user as admin; for multi-tenant, admin creates tenant then invites.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_tenant_id uuid;
begin
  -- If no tenants exist, create one and make this user admin
  select id into first_tenant_id from public.tenants limit 1;
  if first_tenant_id is null then
    insert into public.tenants (name) values ('Default Tenant');
    first_tenant_id := (select id from public.tenants limit 1);
  end if;
  insert into public.profiles (user_id, tenant_id, role)
  values (new.id, first_tenant_id, 'admin');
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
