-- Seed a sample ticket for Marriott (or first site with rooms) so you can try the ticket flow.
-- Run this in Supabase SQL Editor or via migration. Safe to run multiple times (inserts one ticket per run).

insert into public.tickets (
  tenant_id,
  site_id,
  room_id,
  room_label_snapshot,
  request_type,
  note,
  status,
  priority,
  created_via
)
select
  s.tenant_id,
  s.id as site_id,
  r.id as room_id,
  r.room_label as room_label_snapshot,
  'cleaning' as request_type,
  'Guest requested extra towels and toiletries. Room 412 ready for refresh.' as note,
  'new' as status,
  'normal' as priority,
  'qr' as created_via
from public.sites s
join public.rooms r on r.site_id = s.id
where s.id = (
  select s2.id from public.sites s2
  where exists (select 1 from public.rooms where site_id = s2.id)
  order by case when lower(s2.name) like '%marriott%' then 0 else 1 end, s2.name
  limit 1
)
order by r.room_label
limit 1;

-- Add "created" event for the ticket we just inserted (most recent ticket without events)
insert into public.ticket_events (ticket_id, actor_user_id, event_type, payload)
select t.id, null, 'created', jsonb_build_object(
  'note', t.note,
  'request_type', t.request_type,
  'priority', t.priority
)
from public.tickets t
where not exists (select 1 from public.ticket_events e where e.ticket_id = t.id)
order by t.created_at desc
limit 1;
