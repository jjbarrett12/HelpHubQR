-- RLS for HelpHubQR MVP
-- Principle: supervisors (authenticated) read/write by property; anon has no direct access.
-- Staff flows use API routes with service role; no staff rows in auth.users.

alter table public.properties enable row level security;
alter table public.locations enable row level security;
alter table public.qr_codes enable row level security;
alter table public.request_types enable row level security;
alter table public.tasks enable row level security;
alter table public.qr_scans enable row level security;
alter table public.devices enable row level security;
alter table public.shift_tokens enable row level security;
alter table public.task_events enable row level security;
alter table public.proof_of_work enable row level security;
alter table public.supervisor_profiles enable row level security;

-- Helper: current user's property_id (supervisor)
create or replace function public.current_user_property_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select property_id from public.supervisor_profiles where user_id = auth.uid() limit 1;
$$;

-- Policies: authenticated (supervisors) can select/insert/update by property
create policy "properties_select" on public.properties
  for select to authenticated using (true);

create policy "locations_select" on public.locations
  for select to authenticated using (property_id = public.current_user_property_id());

create policy "qr_codes_select" on public.qr_codes
  for select to authenticated using (property_id = public.current_user_property_id());

create policy "request_types_select" on public.request_types
  for select to authenticated using (property_id = public.current_user_property_id());

create policy "tasks_all" on public.tasks
  for all to authenticated using (property_id = public.current_user_property_id());

create policy "qr_scans_select" on public.qr_scans
  for select to authenticated using (property_id = public.current_user_property_id());

create policy "task_events_select" on public.task_events
  for select to authenticated using (property_id = public.current_user_property_id());

create policy "proof_of_work_select" on public.proof_of_work
  for select to authenticated using (property_id = public.current_user_property_id());

create policy "supervisor_profiles_own" on public.supervisor_profiles
  for all to authenticated using (user_id = auth.uid());

-- anon: no direct access (guest/staff use API routes with service role)
-- No policies for anon on these tables.
