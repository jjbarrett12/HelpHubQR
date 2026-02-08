-- Seed one sample ticket so the Tickets list has something to show.
-- Uses the first available site and room. Only inserts when no tickets exist yet.

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
  'Sample ticket: Please refresh towels and restock amenities. Thank you!' as note,
  'new' as status,
  'normal' as priority,
  'qr' as created_via
from public.sites s
join public.rooms r on r.site_id = s.id
where not exists (select 1 from public.tickets limit 1)
order by s.id, r.room_label
limit 1;

-- Add a "created" event for the sample ticket (for any ticket that has no events yet)
insert into public.ticket_events (ticket_id, actor_user_id, event_type, payload)
select t.id, null, 'created', '{"note":"Sample ticket: Please refresh towels and restock amenities. Thank you!","request_type":"cleaning","priority":"normal"}'::jsonb
from public.tickets t
where not exists (select 1 from public.ticket_events e where e.ticket_id = t.id)
limit 1;
