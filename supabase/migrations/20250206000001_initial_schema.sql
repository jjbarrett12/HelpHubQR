-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Tenants: janitorial company using the SaaS
create table public.tenants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Profiles: maps auth.users to tenant + role
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null check (role in ('admin', 'manager', 'staff')),
  created_at timestamptz not null default now()
);

create index idx_profiles_tenant_id on public.profiles(tenant_id);

-- Sites: customer location (hotel)
create table public.sites (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  address text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create index idx_sites_tenant_id on public.sites(tenant_id);

-- Rooms: room label per site
create table public.rooms (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  room_label text not null,
  floor text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(site_id, room_label)
);

create index idx_rooms_site_id on public.rooms(site_id);

-- Room tokens: one unguessable token per room (for QR)
create table public.room_tokens (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null unique references public.rooms(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  last_scanned_at timestamptz,
  revoked_at timestamptz
);

create unique index idx_room_tokens_token on public.room_tokens(token) where revoked_at is null;

-- Tickets: guest/staff requests
create table public.tickets (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  room_label_snapshot text not null,
  request_type text,
  note text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  created_at timestamptz not null default now(),
  created_via text not null default 'qr' check (created_via in ('qr', 'desk', 'staff')),
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_at timestamptz,
  resolved_at timestamptz
);

create index idx_tickets_site_status_created on public.tickets(site_id, status, created_at desc);
create index idx_tickets_tenant_created on public.tickets(tenant_id, created_at desc);
create index idx_tickets_site_id on public.tickets(site_id);

-- Ticket events: audit trail
create table public.ticket_events (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_ticket_events_ticket_id on public.ticket_events(ticket_id);

-- Ticket attachments: storage path only; file in Storage
create table public.ticket_attachments (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index idx_ticket_attachments_ticket_id on public.ticket_attachments(ticket_id);

-- Alert rules: who gets notified per site
create table public.alert_rules (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  channel text not null check (channel in ('sms', 'email')),
  target text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_alert_rules_site_id on public.alert_rules(site_id);

-- Enable Realtime for tickets (staff dashboard)
alter publication supabase_realtime add table public.tickets;
