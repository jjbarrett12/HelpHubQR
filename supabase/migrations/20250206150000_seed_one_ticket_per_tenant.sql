-- Ensure every tenant that has at least one site with rooms gets one sample ticket
-- (so "No tickets yet" is not the default). Idempotent: only inserts for tenants with zero tickets.
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
select distinct on (s.tenant_id)
  s.tenant_id,
  s.id as site_id,
  r.id as room_id,
  r.room_label as room_label_snapshot,
  'Cleaning' as request_type,
  'Sample ticket: guest requested extra towels and trash removal. Use this to try resolving a ticket.' as note,
  'new' as status,
  'normal' as priority,
  'staff' as created_via
from public.sites s
join public.rooms r on r.site_id = s.id
where not exists (
  select 1 from public.tickets t where t.tenant_id = s.tenant_id
)
order by s.tenant_id, s.id, r.room_label;

-- Add "created" event for any ticket that has no events yet
insert into public.ticket_events (ticket_id, actor_user_id, event_type, payload)
select t.id, null, 'created', jsonb_build_object(
  'note', t.note,
  'request_type', t.request_type,
  'priority', t.priority
)
from public.tickets t
where not exists (select 1 from public.ticket_events e where e.ticket_id = t.id)
order by t.created_at desc;
