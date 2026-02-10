-- Guest status tokens: short-lived link for guests to check request status (no login)
create table if not exists public.guest_status_tokens (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_guest_status_tokens_token on public.guest_status_tokens(token);
create index idx_guest_status_tokens_expires on public.guest_status_tokens(expires_at);

-- Property-level alert rules for SLA breach (MVP tasks). Same pattern as alert_rules (sites).
create table if not exists public.property_alert_rules (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.properties(id) on delete cascade,
  channel text not null check (channel in ('sms', 'email')),
  target text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_property_alert_rules_property on public.property_alert_rules(property_id);

-- RLS: property_alert_rules are readable by supervisors of that property (via service role in Edge Function)
alter table public.property_alert_rules enable row level security;

create policy "property_alert_rules_select_supervisor"
  on public.property_alert_rules for select
  using (
    exists (
      select 1 from public.supervisor_profiles sp
      where sp.property_id = property_alert_rules.property_id
      and sp.user_id = auth.uid()
    )
  );

create policy "property_alert_rules_all_supervisor"
  on public.property_alert_rules for all
  using (
    exists (
      select 1 from public.supervisor_profiles sp
      where sp.property_id = property_alert_rules.property_id
      and sp.user_id = auth.uid()
    )
  );

-- guest_status_tokens: RLS on. Only service role (create-ticket Edge Function, Next.js API) reads/writes; no anon access.
alter table public.guest_status_tokens enable row level security;

-- No policies: anon/authenticated get no access. Service role bypasses RLS for lookups and for create-ticket inserts.
comment on table public.guest_status_tokens is 'Short-lived tokens so guests can view ticket status at /t/status/[token]';
comment on table public.property_alert_rules is 'SLA breach alerts per property (MVP); supervisors configure email/SMS';

-- Optional guest email on tickets for "request completed" notification
alter table public.tickets add column if not exists guest_email text;

-- Audit log for ticket and settings changes (actor + action + payload)
create table if not exists public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index idx_audit_log_created on public.audit_log(created_at desc);

alter table public.audit_log enable row level security;

-- Only service role or tenant-scoped reads (e.g. via API that checks tenant) should access audit_log.
-- No policies: app uses service role to insert; reads can be done via API that enforces tenant.
comment on table public.audit_log is 'Audit trail for ticket status changes and settings updates';
