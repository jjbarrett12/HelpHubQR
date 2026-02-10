-- Seed one dev property with rooms, qr_codes, request_types (for local/pilot testing)
-- Run after 001_init.sql (and optionally 002_rls.sql).

insert into public.properties (id, name, timezone, branding)
values (
  'a0000000-0000-4000-8000-000000000001',
  'Demo Hotel',
  'America/New_York',
  '{"logo_url": null, "primary_color": "#0ea5e9", "support_phone": "+1-555-0100"}'::jsonb
)
on conflict (id) do nothing;

-- Locations: rooms 101, 102, 103 and Lobby
insert into public.locations (id, property_id, type, identifier)
values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'room', '101'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'room', '102'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'room', '103'),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'public_area', 'Lobby')
on conflict (property_id, type, identifier) do nothing;

-- QR codes: base62-style ids (use short unguessable tokens in production)
insert into public.qr_codes (id, property_id, location_id, status, mode_default)
values
  ('qdemo101', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'active', 'auto'),
  ('qdemo102', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'active', 'auto'),
  ('qdemo103', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'active', 'auto'),
  ('qdemolobby', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'active', 'auto')
on conflict (id) do nothing;

-- Request types
insert into public.request_types (property_id, code, label, department, default_priority, default_sla_minutes, is_active)
values
  ('a0000000-0000-4000-8000-000000000001', 'towels', 'Towels', 'hk', 2, 60, true),
  ('a0000000-0000-4000-8000-000000000001', 'refresh', 'Room refresh', 'hk', 2, 90, true),
  ('a0000000-0000-4000-8000-000000000001', 'maintenance', 'Maintenance', 'eng', 3, 120, true),
  ('a0000000-0000-4000-8000-000000000001', 'other', 'Other', 'ops', 2, 60, true)
on conflict do nothing;

-- One shift token for staff testing (role hk, valid 1 year)
insert into public.shift_tokens (property_id, role, token, valid_from, valid_to)
values (
  'a0000000-0000-4000-8000-000000000001',
  'hk',
  'shift-demo-hk-12345',
  now(),
  now() + interval '1 year'
)
on conflict (token) do nothing;
