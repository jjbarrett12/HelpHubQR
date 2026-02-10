-- HelpHubQR MVP schema (plan-aligned). See /sql/001_init.sql for canonical source.
create extension if not exists "uuid-ossp";

create type location_type as enum ('room', 'public_area');
create type qr_status as enum ('active', 'disabled', 'rotated');
create type qr_mode_default as enum ('auto', 'guest', 'staff');
create type scan_context as enum ('guest', 'staff', 'supervisor');
create type task_status as enum ('open', 'assigned', 'in_progress', 'completed', 'canceled');
create type department_enum as enum ('hk', 'eng', 'ops');
create type task_event_type as enum ('created', 'assigned', 'started', 'escalated', 'completed', 'reopened', 'note_added');
create type actor_type as enum ('guest', 'staff', 'supervisor', 'system');
create type actor_role as enum ('hk', 'eng', 'sup', 'guest');
create type staff_role as enum ('hk', 'eng', 'sup');

create table public.properties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  timezone text not null default 'UTC',
  branding jsonb default '{}',
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  type location_type not null,
  identifier text not null,
  created_at timestamptz not null default now(),
  unique(property_id, type, identifier)
);
create index idx_locations_property_id on public.locations(property_id);

create table public.qr_codes (
  id text primary key,
  property_id uuid not null references public.properties(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  status qr_status not null default 'active',
  mode_default qr_mode_default not null default 'auto',
  secret_version int not null default 1,
  created_at timestamptz not null default now(),
  rotated_from_id text references public.qr_codes(id)
);
create index idx_qr_codes_property_location on public.qr_codes(property_id, location_id);
create index idx_qr_codes_status on public.qr_codes(status) where status = 'active';

create table public.request_types (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  code text not null,
  label text not null,
  department department_enum not null,
  default_priority int not null default 2,
  default_sla_minutes int not null default 60,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(property_id, code)
);
create index idx_request_types_property on public.request_types(property_id);

create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  request_type_id uuid not null references public.request_types(id) on delete restrict,
  status task_status not null default 'open',
  priority int not null default 2,
  sla_minutes int not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  last_event_at timestamptz not null default now()
);
create index idx_tasks_property_status on public.tasks(property_id, status);
create index idx_tasks_location on public.tasks(location_id, status);
create index idx_tasks_last_event on public.tasks(last_event_at);

create table public.qr_scans (
  id uuid primary key default uuid_generate_v4(),
  qr_id text not null references public.qr_codes(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  scan_context scan_context not null,
  device_id text,
  created_at timestamptz not null default now(),
  metadata jsonb default '{}'
);
create index idx_qr_scans_qr_created on public.qr_scans(qr_id, created_at desc);

create table public.devices (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  install_id_hash text not null,
  shared boolean not null default false,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique(property_id, install_id_hash)
);
create index idx_devices_property on public.devices(property_id);

create table public.shift_tokens (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  role staff_role not null,
  token text not null unique,
  valid_from timestamptz not null default now(),
  valid_to timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_shift_tokens_token on public.shift_tokens(token);
create index idx_shift_tokens_property on public.shift_tokens(property_id);

create table public.task_events (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  event_type task_event_type not null,
  actor_type actor_type not null,
  actor_role actor_role not null,
  shift_token_id uuid references public.shift_tokens(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  qr_scan_id uuid references public.qr_scans(id) on delete set null,
  timestamp timestamptz not null default now(),
  metadata jsonb default '{}'
);
create index idx_task_events_task_id on public.task_events(task_id);
create index idx_task_events_property on public.task_events(property_id, timestamp desc);

create table public.proof_of_work (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  completed_event_id uuid not null references public.task_events(id) on delete cascade,
  photo_path text,
  note text,
  created_at timestamptz not null default now()
);
create index idx_proof_of_work_task on public.proof_of_work(task_id);

create table if not exists public.supervisor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  role text not null default 'supervisor',
  created_at timestamptz not null default now()
);
create index if not exists idx_supervisor_profiles_property on public.supervisor_profiles(property_id);
