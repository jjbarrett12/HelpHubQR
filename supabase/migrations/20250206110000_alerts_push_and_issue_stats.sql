-- Allow 'push' channel in alert_rules
alter table public.alert_rules drop constraint if exists alert_rules_channel_check;
alter table public.alert_rules add constraint alert_rules_channel_check
  check (channel in ('sms', 'email', 'push'));

-- Push subscriptions: staff devices per site (for web push)
create table public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique(endpoint)
);

create index idx_push_subscriptions_site_id on public.push_subscriptions(site_id);

-- Issue stats: track incoming/resolved counts per site per day
create table public.site_daily_stats (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references public.sites(id) on delete cascade,
  stat_date date not null,
  issues_incoming int not null default 0,
  issues_resolved int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, stat_date)
);

create index idx_site_daily_stats_site_date on public.site_daily_stats(site_id, stat_date desc);

-- Trigger: on ticket insert, increment issues_incoming for today
create or replace function public.inc_site_daily_incoming()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (new.created_at at time zone 'UTC')::date;
begin
  insert into public.site_daily_stats (site_id, stat_date, issues_incoming, issues_resolved, updated_at)
  values (new.site_id, d, 1, 0, now())
  on conflict (site_id, stat_date)
  do update set
    issues_incoming = site_daily_stats.issues_incoming + 1,
    updated_at = now();
  return new;
end;
$$;

create trigger ticket_inc_incoming
  after insert on public.tickets
  for each row
  execute function public.inc_site_daily_incoming();

-- Trigger: on ticket update to resolved, increment issues_resolved for today
create or replace function public.inc_site_daily_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (new.resolved_at at time zone 'UTC')::date;
begin
  if new.status = 'resolved' and (old.status is null or old.status <> 'resolved') and new.resolved_at is not null then
    insert into public.site_daily_stats (site_id, stat_date, issues_incoming, issues_resolved, updated_at)
    values (new.site_id, d, 0, 1, now())
    on conflict (site_id, stat_date)
    do update set
      issues_resolved = site_daily_stats.issues_resolved + 1,
      updated_at = now();
  end if;
  return new;
end;
$$;

create trigger ticket_inc_resolved
  after update on public.tickets
  for each row
  execute function public.inc_site_daily_resolved();

-- RLS for new tables
alter table public.push_subscriptions enable row level security;
alter table public.site_daily_stats enable row level security;

create policy "push_subscriptions_tenant"
  on public.push_subscriptions for all
  using (
    site_id in (select id from public.sites where tenant_id = public.current_tenant_id())
  )
  with check (
    site_id in (select id from public.sites where tenant_id = public.current_tenant_id())
  );

create policy "site_daily_stats_tenant"
  on public.site_daily_stats for select
  using (
    site_id in (select id from public.sites where tenant_id = public.current_tenant_id())
  );

-- Backfill today's incoming count from tickets created today (before trigger existed)
insert into public.site_daily_stats (site_id, stat_date, issues_incoming, issues_resolved, updated_at)
select
  site_id,
  (now() at time zone 'UTC')::date as stat_date,
  count(*)::int as issues_incoming,
  0 as issues_resolved,
  now() as updated_at
from public.tickets
where (created_at at time zone 'UTC')::date = (now() at time zone 'UTC')::date
group by site_id
on conflict (site_id, stat_date) do update set
  issues_incoming = greatest(site_daily_stats.issues_incoming, excluded.issues_incoming),
  updated_at = now();
