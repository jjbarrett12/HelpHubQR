-- Shift operations platform: employee-facing announcements, run-item note history,
-- help/problem rows (see coexistence notes with shift_checklist_run_item_escalations),
-- shift logs, unified issues, and relaxed audit event types on existing events table.
--
-- ASSUMPTIONS (existing schema):
--   public.organizations, locations, employees, auth.users, employee_shifts,
--   shift_checklist_runs, shift_checklist_run_items, qr_destinations, hh_set_updated_at,
--   hh_org_ids_for_user, hh_user_can_manage_org, hh_employee_id_for_user
-- ALREADY EXISTS:
--   shift_checklist_run_item_events (20260331210000) — extended here, not recreated.
--   shift_checklist_run_item_escalations (problem/help) — keep RPC path; new help/problem
--     tables are additive for richer workflows; avoid dual-writes (pick one in app layer).
--   operational_messages (20260331240000) — org broadcasts; employee_announcements adds
--     location/employee targeting variants. Product may unify later.
-- BACKFILL (later, not in migration):
--   qr_issue_reports → issues (origin='qr'), employee_announcements from legacy content.

-- ---------------------------------------------------------------------------
-- 1) employee_announcements (targeted / location / org notices)
--    Operational truth for this feed; not chat.
-- ---------------------------------------------------------------------------
CREATE TABLE public.employee_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations (id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees (id) ON DELETE CASCADE,
  title text,
  message text NOT NULL,
  message_type text NOT NULL DEFAULT 'announcement',
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_announcements_target_chk CHECK (
    -- At least one targeting dimension: whole org (both null), location, or single employee
    (location_id IS NULL AND employee_id IS NULL)
    OR (location_id IS NOT NULL AND employee_id IS NULL)
    OR (employee_id IS NOT NULL)
  )
);

CREATE INDEX employee_announcements_org_expires_idx
  ON public.employee_announcements (organization_id, expires_at DESC NULLS LAST);
CREATE INDEX employee_announcements_org_created_idx
  ON public.employee_announcements (organization_id, created_at DESC);
CREATE INDEX employee_announcements_employee_idx
  ON public.employee_announcements (employee_id)
  WHERE employee_id IS NOT NULL;
CREATE INDEX employee_announcements_location_idx
  ON public.employee_announcements (location_id)
  WHERE location_id IS NOT NULL;

CREATE TRIGGER employee_announcements_set_updated_at
  BEFORE UPDATE ON public.employee_announcements
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

COMMENT ON TABLE public.employee_announcements IS
  'Operational notices to org / location / single employee. Coexists with operational_messages; prefer one product path long-term.';

-- ---------------------------------------------------------------------------
-- 2) employee_announcement_reads
-- ---------------------------------------------------------------------------
CREATE TABLE public.employee_announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.employee_announcements (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, employee_id)
);

CREATE INDEX employee_announcement_reads_employee_idx
  ON public.employee_announcement_reads (employee_id, read_at DESC);

-- ---------------------------------------------------------------------------
-- 3) shift_checklist_run_item_notes (append-only note history; run_items.notes remains current snapshot)
-- ---------------------------------------------------------------------------
CREATE TABLE public.shift_checklist_run_item_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  run_item_id uuid NOT NULL REFERENCES public.shift_checklist_run_items (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shift_checklist_run_item_notes_run_item_idx
  ON public.shift_checklist_run_item_notes (run_item_id, created_at DESC);
CREATE INDEX shift_checklist_run_item_notes_org_created_idx
  ON public.shift_checklist_run_item_notes (organization_id, created_at DESC);

COMMENT ON TABLE public.shift_checklist_run_item_notes IS
  'Append-only note history per run item. Execution snapshot still on shift_checklist_run_items.notes.';

-- ---------------------------------------------------------------------------
-- 4) shift_checklist_run_item_events — EXISTS: relax event_type for generic audit (payload = API event_payload)
-- ---------------------------------------------------------------------------
ALTER TABLE public.shift_checklist_run_item_events
  DROP CONSTRAINT IF EXISTS shift_checklist_run_item_events_event_type_check;

ALTER TABLE public.shift_checklist_run_item_events
  ADD CONSTRAINT shift_checklist_run_item_events_event_type_chk
  CHECK (
    char_length(trim(event_type)) > 0
    AND char_length(event_type) <= 128
  );

COMMENT ON COLUMN public.shift_checklist_run_item_events.payload IS
  'JSON audit payload; API contracts may call this event_payload. shift_checklist_run_item_id is run_item_id.';

-- ---------------------------------------------------------------------------
-- 5) shift_checklist_run_item_help_requests
--    Coexists with shift_checklist_run_item_escalations(kind=help); do not double-insert.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shift_checklist_run_item_help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  run_item_id uuid NOT NULL REFERENCES public.shift_checklist_run_items (id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'resolved', 'cancelled')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX shift_checklist_run_item_help_org_status_idx
  ON public.shift_checklist_run_item_help_requests (organization_id, status, created_at DESC);
CREATE INDEX shift_checklist_run_item_help_run_item_idx
  ON public.shift_checklist_run_item_help_requests (run_item_id, created_at DESC);
CREATE INDEX shift_checklist_run_item_help_assigned_idx
  ON public.shift_checklist_run_item_help_requests (assigned_to)
  WHERE assigned_to IS NOT NULL;

COMMENT ON TABLE public.shift_checklist_run_item_help_requests IS
  'Help requests on a run item. Optional parallel to shift_checklist_run_item_escalations; consolidate writes in application logic.';

-- ---------------------------------------------------------------------------
-- 6) shift_checklist_run_item_problems
--    Coexists with shift_checklist_run_item_escalations(kind=problem).
-- ---------------------------------------------------------------------------
CREATE TABLE public.shift_checklist_run_item_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  run_item_id uuid NOT NULL REFERENCES public.shift_checklist_run_items (id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'critical')),
  problem_type text,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX shift_checklist_run_item_problems_org_status_idx
  ON public.shift_checklist_run_item_problems (organization_id, status, created_at DESC);
CREATE INDEX shift_checklist_run_item_problems_run_item_idx
  ON public.shift_checklist_run_item_problems (run_item_id, created_at DESC);

COMMENT ON TABLE public.shift_checklist_run_item_problems IS
  'Structured problem reports on a run item. Optional parallel to shift_checklist_run_item_escalations.';

-- ---------------------------------------------------------------------------
-- 7) shift_logs — operational / incident memory at location (shift optional)
-- ---------------------------------------------------------------------------
CREATE TABLE public.shift_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations (id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.employee_shifts (id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  log_type text NOT NULL DEFAULT 'note' CHECK (log_type IN ('note', 'incident', 'handoff', 'equipment', 'safety', 'other')),
  severity text NOT NULL DEFAULT 'normal' CHECK (severity IN ('low', 'normal', 'high', 'critical')),
  title text NOT NULL,
  description text,
  photo_storage_path text,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shift_logs_org_location_created_idx
  ON public.shift_logs (organization_id, location_id, created_at DESC);
CREATE INDEX shift_logs_shift_idx
  ON public.shift_logs (shift_id, created_at DESC)
  WHERE shift_id IS NOT NULL;
CREATE INDEX shift_logs_employee_idx
  ON public.shift_logs (employee_id, created_at DESC)
  WHERE employee_id IS NOT NULL;

COMMENT ON TABLE public.shift_logs IS
  'Operational shift/location log lines (not analytics). execution truth for checklists stays on run items.';

-- ---------------------------------------------------------------------------
-- 8) issues — unified QR + app issue tracking (alongside legacy qr_issue_reports)
-- ---------------------------------------------------------------------------
CREATE TABLE public.issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations (id) ON DELETE SET NULL,
  shift_id uuid REFERENCES public.employee_shifts (id) ON DELETE SET NULL,
  reported_by uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  qr_destination_id uuid REFERENCES public.qr_destinations (id) ON DELETE SET NULL,
  origin text NOT NULL DEFAULT 'app' CHECK (origin IN ('qr', 'app', 'manager', 'system', 'api')),
  category text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  title text NOT NULL,
  description text,
  photo_storage_path text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triaged', 'in_progress', 'resolved', 'closed', 'cancelled')),
  assigned_to uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX issues_org_status_idx ON public.issues (organization_id, status, created_at DESC);
CREATE INDEX issues_org_location_idx ON public.issues (organization_id, location_id, created_at DESC);
CREATE INDEX issues_qr_destination_idx ON public.issues (qr_destination_id) WHERE qr_destination_id IS NOT NULL;
CREATE INDEX issues_reported_by_idx ON public.issues (reported_by) WHERE reported_by IS NOT NULL;
CREATE INDEX issues_assigned_to_idx ON public.issues (assigned_to) WHERE assigned_to IS NOT NULL;

COMMENT ON TABLE public.issues IS
  'Unified operational issues (app + QR). Legacy qr_issue_reports remains; backfill/migrate when ready.';

-- ---------------------------------------------------------------------------
-- RLS (org-scoped; managers override; align with existing member-wide SELECT on runs)
-- ---------------------------------------------------------------------------
ALTER TABLE public.employee_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_checklist_run_item_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_checklist_run_item_help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_checklist_run_item_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- employee_announcements: members see rows in their orgs matching targeting + active window
CREATE POLICY employee_announcements_select_member
  ON public.employee_announcements FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid()))
    AND (
      public.hh_user_can_manage_org (auth.uid(), organization_id)
      OR (
        (starts_at IS NULL OR starts_at <= now())
        AND (expires_at IS NULL OR expires_at > now())
        AND public.hh_employee_id_for_user (auth.uid(), organization_id) IS NOT NULL
        AND (
          (
            employee_id IS NULL
            AND location_id IS NULL
          )
          OR (
            employee_id = public.hh_employee_id_for_user (auth.uid(), organization_id)
          )
          OR (
            location_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.employees e
              WHERE
                e.id = public.hh_employee_id_for_user (auth.uid(), organization_id)
                AND e.location_id = employee_announcements.location_id
            )
          )
        )
      )
    )
  );

CREATE POLICY employee_announcements_write_manager
  ON public.employee_announcements FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org (auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org (auth.uid(), organization_id));

CREATE POLICY employee_announcement_reads_select
  ON public.employee_announcement_reads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employee_announcements a
      WHERE
        a.id = employee_announcement_reads.announcement_id
        AND (
          public.hh_user_can_manage_org (auth.uid(), a.organization_id)
          OR employee_announcement_reads.employee_id = public.hh_employee_id_for_user (auth.uid(), a.organization_id)
        )
    )
  );

CREATE POLICY employee_announcement_reads_insert_self
  ON public.employee_announcement_reads FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.hh_employee_id_for_user (
      auth.uid(),
      (
        SELECT a.organization_id
        FROM public.employee_announcements a
        WHERE a.id = announcement_id
      )
    )
  );

CREATE POLICY employee_announcement_reads_delete_manager
  ON public.employee_announcement_reads FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employee_announcements a
      WHERE
        a.id = employee_announcement_reads.announcement_id
        AND public.hh_user_can_manage_org (auth.uid(), a.organization_id)
    )
  );

-- Notes / help / problems: org members read (same broad pattern as shift_checklist_run_items)
CREATE POLICY shift_checklist_run_item_notes_select_member
  ON public.shift_checklist_run_item_notes FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid())));

CREATE POLICY shift_checklist_run_item_notes_insert_member
  ON public.shift_checklist_run_item_notes FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid()))
    AND employee_id = public.hh_employee_id_for_user (auth.uid(), organization_id)
  );

CREATE POLICY shift_checklist_run_item_help_select_member
  ON public.shift_checklist_run_item_help_requests FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid())));

CREATE POLICY shift_checklist_run_item_help_insert_member
  ON public.shift_checklist_run_item_help_requests FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid()))
    AND requested_by = public.hh_employee_id_for_user (auth.uid(), organization_id)
  );

CREATE POLICY shift_checklist_run_item_help_update_member
  ON public.shift_checklist_run_item_help_requests FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid()))
    AND (
      public.hh_user_can_manage_org (auth.uid(), organization_id)
      OR requested_by = public.hh_employee_id_for_user (auth.uid(), organization_id)
      OR assigned_to = public.hh_employee_id_for_user (auth.uid(), organization_id)
    )
  )
  WITH CHECK (organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid())));

CREATE POLICY shift_checklist_run_item_problems_select_member
  ON public.shift_checklist_run_item_problems FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid())));

CREATE POLICY shift_checklist_run_item_problems_insert_member
  ON public.shift_checklist_run_item_problems FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid()))
    AND reported_by = public.hh_employee_id_for_user (auth.uid(), organization_id)
  );

CREATE POLICY shift_checklist_run_item_problems_update_member
  ON public.shift_checklist_run_item_problems FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid()))
    AND (
      public.hh_user_can_manage_org (auth.uid(), organization_id)
      OR reported_by = public.hh_employee_id_for_user (auth.uid(), organization_id)
    )
  )
  WITH CHECK (organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid())));

-- shift_logs + issues: org members SELECT; managers full write; employees INSERT issues/shift_logs where reporter matches (optional tighten later)
CREATE POLICY shift_logs_select_member
  ON public.shift_logs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid())));

CREATE POLICY shift_logs_insert_authenticated
  ON public.shift_logs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid()))
    AND created_by = auth.uid()
  );

CREATE POLICY shift_logs_update_manager
  ON public.shift_logs FOR UPDATE TO authenticated
  USING (public.hh_user_can_manage_org (auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org (auth.uid(), organization_id));

CREATE POLICY shift_logs_delete_manager
  ON public.shift_logs FOR DELETE TO authenticated
  USING (public.hh_user_can_manage_org (auth.uid(), organization_id));

CREATE POLICY issues_select_member
  ON public.issues FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid())));

CREATE POLICY issues_insert_member
  ON public.issues FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid()))
    AND (
      reported_by IS NULL
      OR reported_by = public.hh_employee_id_for_user (auth.uid(), organization_id)
    )
  );

CREATE POLICY issues_update_member
  ON public.issues FOR UPDATE TO authenticated
  USING (
    organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid()))
    AND (
      public.hh_user_can_manage_org (auth.uid(), organization_id)
      OR reported_by = public.hh_employee_id_for_user (auth.uid(), organization_id)
      OR assigned_to = public.hh_employee_id_for_user (auth.uid(), organization_id)
    )
  )
  WITH CHECK (organization_id IN (SELECT public.hh_org_ids_for_user (auth.uid())));

CREATE POLICY issues_delete_manager
  ON public.issues FOR DELETE TO authenticated
  USING (public.hh_user_can_manage_org (auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.employee_announcements FROM anon;
REVOKE ALL ON public.employee_announcement_reads FROM anon;
REVOKE ALL ON public.shift_checklist_run_item_notes FROM anon;
REVOKE ALL ON public.shift_checklist_run_item_help_requests FROM anon;
REVOKE ALL ON public.shift_checklist_run_item_problems FROM anon;
REVOKE ALL ON public.shift_logs FROM anon;
REVOKE ALL ON public.issues FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_announcements TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.employee_announcement_reads TO authenticated;
GRANT SELECT, INSERT ON public.shift_checklist_run_item_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.shift_checklist_run_item_help_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.shift_checklist_run_item_problems TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issues TO authenticated;
