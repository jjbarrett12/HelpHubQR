-- HelpHubQR post-refactor integrity checks (run in Supabase SQL editor or psql).
-- Adjust schema if your project uses a different search_path.

-- 1) Tenant memberships: one active row per (tenant_id, user_id)
SELECT tenant_id, user_id, COUNT(*) AS n
FROM public.tenant_memberships
GROUP BY tenant_id, user_id
HAVING COUNT(*) > 1;

-- 2) Tickets: site and room belong to same tenant as ticket (sample violations)
SELECT t.id, t.tenant_id AS ticket_tenant, s.tenant_id AS site_tenant, r.tenant_id AS room_tenant
FROM public.tickets t
JOIN public.sites s ON s.id = t.site_id
JOIN public.rooms r ON r.id = t.room_id
WHERE t.tenant_id IS DISTINCT FROM s.tenant_id
   OR t.tenant_id IS DISTINCT FROM r.tenant_id
   OR s.tenant_id IS DISTINCT FROM r.tenant_id
LIMIT 50;

-- 3) Assignee must be member of ticket tenant (active)
SELECT t.id, t.tenant_id, t.assigned_to
FROM public.tickets t
WHERE t.assigned_to IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships m
    WHERE m.tenant_id = t.tenant_id
      AND m.user_id = t.assigned_to
      AND m.status = 'active'
  )
LIMIT 50;

-- 4) Pending invites: unique lower(email) per tenant (constraint should prevent dupes — should return 0 rows)
SELECT tenant_id, lower(trim(email)) AS em, COUNT(*) AS n
FROM public.tenant_invites
WHERE status = 'pending'
GROUP BY tenant_id, lower(trim(email))
HAVING COUNT(*) > 1;

-- 5) Room tokens: active token should reference non-archived room (guest flow)
SELECT rt.id, rt.room_id, r.archived_at, s.archived_at AS site_archived
FROM public.room_tokens rt
JOIN public.rooms r ON r.id = rt.room_id
JOIN public.sites s ON s.id = r.site_id
WHERE rt.revoked_at IS NULL
  AND (r.archived_at IS NOT NULL OR s.archived_at IS NOT NULL)
LIMIT 50;

-- 6) Idempotency: duplicate client_request_id per tenant (partial unique index — should be 0)
SELECT tenant_id, client_request_id, COUNT(*) AS n
FROM public.tickets
WHERE client_request_id IS NOT NULL AND btrim(client_request_id) <> ''
GROUP BY tenant_id, client_request_id
HAVING COUNT(*) > 1;

-- 7) Tickets missing request_type_id but legacy column dropped — optional catalog drift (informational)
SELECT COUNT(*) AS tickets_with_null_request_type_id
FROM public.tickets
WHERE request_type_id IS NULL;
