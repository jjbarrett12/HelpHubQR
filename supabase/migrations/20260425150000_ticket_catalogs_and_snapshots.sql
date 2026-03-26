-- Normalized ticket request types, canonical ticket event types, ticket snapshots, attachment metadata.
-- Preserves history by backfilling FKs and snapshots before dropping legacy text columns.

-- ---------------------------------------------------------------------------
-- 1) Canonical ticket event types (ticket_events.event_type → FK)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_event_types (
  code text PRIMARY KEY,
  label text NOT NULL
);

INSERT INTO public.ticket_event_types (code, label) VALUES
  ('created', 'Created'),
  ('assigned', 'Assigned'),
  ('unassigned', 'Unassigned'),
  ('status_changed', 'Status changed'),
  ('priority_changed', 'Priority changed'),
  ('attachment_added', 'Attachment added'),
  ('comment_added', 'Comment added'),
  ('resolved', 'Resolved'),
  ('reopened', 'Reopened'),
  ('cancelled', 'Cancelled')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label;

-- ---------------------------------------------------------------------------
-- 2) Ticket request type catalog (per-tenant overrides + global defaults)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_request_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_request_types_code_trim CHECK (char_length(trim(code)) > 0),
  CONSTRAINT ticket_request_types_label_trim CHECK (char_length(trim(label)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ticket_request_types_global_code_uidx
  ON public.ticket_request_types (lower(trim(code)))
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ticket_request_types_tenant_code_uidx
  ON public.ticket_request_types (tenant_id, lower(trim(code)))
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ticket_request_types_tenant_active_idx
  ON public.ticket_request_types (tenant_id, active)
  WHERE active = true;

-- Global MVP defaults (tenant_id NULL); partial unique → idempotent NOT EXISTS insert
INSERT INTO public.ticket_request_types (tenant_id, code, label, active)
SELECT NULL, v.code, v.label, true
FROM (VALUES
  ('towels', 'Towels'),
  ('trash_removal', 'Trash removal'),
  ('toiletries', 'Toiletries'),
  ('cleaning', 'Cleaning'),
  ('other', 'Other')
) AS v(code, label)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ticket_request_types t
  WHERE t.tenant_id IS NULL AND lower(trim(t.code)) = lower(trim(v.code))
);

-- ---------------------------------------------------------------------------
-- 3) tickets: FK + snapshots; drop legacy request_type text
-- ---------------------------------------------------------------------------
DO $tickets_mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) THEN
    RAISE NOTICE 'Skipping tickets columns: public.tickets missing.';
    RETURN;
  END IF;

  ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS request_type_id uuid REFERENCES public.ticket_request_types (id) ON DELETE SET NULL;
  ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS request_type_label_snapshot text;
  ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS site_name_snapshot text;
  ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS floor_snapshot text;

  -- Map legacy free-text labels to global catalog (case-insensitive / normalized)
  UPDATE public.tickets t
  SET request_type_id = rt.id
  FROM public.ticket_request_types rt
  WHERE rt.tenant_id IS NULL
    AND t.request_type_id IS NULL
    AND t.request_type IS NOT NULL
    AND length(trim(t.request_type)) > 0
    AND (
      lower(trim(t.request_type)) = lower(trim(rt.label))
      OR lower(regexp_replace(trim(t.request_type), '\s+', ' ', 'g')) = lower(regexp_replace(trim(rt.label), '\s+', ' ', 'g'))
      OR lower(trim(t.request_type)) = lower(trim(rt.code))
      OR (lower(trim(t.request_type)) = 'trash' AND rt.code = 'trash_removal')
    );

  -- Remaining custom text → other
  UPDATE public.tickets t
  SET request_type_id = o.id
  FROM public.ticket_request_types o
  WHERE o.tenant_id IS NULL AND o.code = 'other'
    AND t.request_type_id IS NULL
    AND t.request_type IS NOT NULL
    AND length(trim(t.request_type)) > 0;

  UPDATE public.tickets t
  SET
    request_type_label_snapshot = COALESCE(nullif(trim(t.request_type), ''), rt.label),
    site_name_snapshot = COALESCE(t.site_name_snapshot, s.name),
    floor_snapshot = COALESCE(t.floor_snapshot, r.floor)
  FROM public.rooms r
  JOIN public.sites s ON s.id = r.site_id
  LEFT JOIN public.ticket_request_types rt ON rt.id = t.request_type_id
  WHERE r.id = t.room_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'request_type'
  ) THEN
    ALTER TABLE public.tickets DROP COLUMN request_type;
  END IF;

  CREATE INDEX IF NOT EXISTS tickets_request_type_id_idx ON public.tickets (request_type_id);
END
$tickets_mig$;

-- ---------------------------------------------------------------------------
-- 4) ticket_events: normalize + FK to ticket_event_types
-- ---------------------------------------------------------------------------
DO $tev_mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ticket_events'
  ) THEN
    RAISE NOTICE 'Skipping ticket_events FK: table missing.';
    RETURN;
  END IF;

  UPDATE public.ticket_events SET event_type = 'comment_added' WHERE event_type = 'internal_note';

  UPDATE public.ticket_events e
  SET event_type = 'comment_added'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ticket_event_types t WHERE t.code = e.event_type
  );

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_events_event_type_fkey'
  ) THEN
    ALTER TABLE public.ticket_events
      ADD CONSTRAINT ticket_events_event_type_fkey
      FOREIGN KEY (event_type) REFERENCES public.ticket_event_types (code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END
$tev_mig$;

-- ---------------------------------------------------------------------------
-- 5) ticket_attachments metadata (if table exists)
-- ---------------------------------------------------------------------------
DO $att$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ticket_attachments'
  ) THEN
    RAISE NOTICE 'Skipping ticket_attachments columns: table missing.';
    RETURN;
  END IF;

  ALTER TABLE public.ticket_attachments ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;
  ALTER TABLE public.ticket_attachments ADD COLUMN IF NOT EXISTS original_filename text;
  ALTER TABLE public.ticket_attachments ADD COLUMN IF NOT EXISTS mime_type text;
  ALTER TABLE public.ticket_attachments ADD COLUMN IF NOT EXISTS file_size_bytes bigint;
  ALTER TABLE public.ticket_attachments ADD COLUMN IF NOT EXISTS bucket_name text;
  ALTER TABLE public.ticket_attachments ADD COLUMN IF NOT EXISTS checksum text;
END
$att$;

-- ---------------------------------------------------------------------------
-- 6) RLS: reference catalogs readable by authenticated tenants; service role bypasses
-- ---------------------------------------------------------------------------
ALTER TABLE public.ticket_event_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_event_types_select_all ON public.ticket_event_types;
CREATE POLICY ticket_event_types_select_all
  ON public.ticket_event_types FOR SELECT TO authenticated, anon
  USING (true);

ALTER TABLE public.ticket_request_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ticket_request_types_select_scoped ON public.ticket_request_types;
CREATE POLICY ticket_request_types_select_scoped
  ON public.ticket_request_types FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.user_id = auth.uid()
        AND m.tenant_id = ticket_request_types.tenant_id
        AND m.status = 'active'
    )
  );

GRANT SELECT ON public.ticket_event_types TO authenticated, anon;
GRANT SELECT ON public.ticket_request_types TO authenticated;

