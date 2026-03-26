-- Strict RLS for operational tables: least privilege for employees, org-wide for managers.
-- Assumes: public.organization_members (user_id, organization_id, role, is_active),
--   roles 'owner'|'manager'|'admin' for management; public.employees (auth_user_id, organization_id, location_id, is_active).
-- Existing helpers hh_org_ids_for_user, hh_user_can_manage_org, hh_employee_id_for_user remain canonical;
-- new wrappers below match the security architect naming contract.

-- ---------------------------------------------------------------------------
-- 1) Helper functions (SECURITY DEFINER, STABLE, search_path pinned)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.hh_is_org_member(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE
      m.user_id = p_user_id
      AND m.organization_id = p_org_id
      AND m.is_active = true
  );
$$;

COMMENT ON FUNCTION public.hh_is_org_member(uuid, uuid) IS
  'True if user is an active member of the organization (any role).';

CREATE OR REPLACE FUNCTION public.hh_is_org_manager(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.hh_user_can_manage_org(p_user_id, p_org_id);
$$;

COMMENT ON FUNCTION public.hh_is_org_manager(uuid, uuid) IS
  'Synonym for hh_user_can_manage_org (owner/manager/admin).';

CREATE OR REPLACE FUNCTION public.hh_current_employee_id(p_org_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.hh_employee_id_for_user(auth.uid(), p_org_id);
$$;

COMMENT ON FUNCTION public.hh_current_employee_id(uuid) IS
  'Linked employees.id for auth.uid() in the given org, or NULL.';

CREATE OR REPLACE FUNCTION public.hh_is_employee_self(p_employee_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.hh_employee_id_for_user(auth.uid(), p_org_id) IS NOT DISTINCT FROM p_employee_id;
$$;

COMMENT ON FUNCTION public.hh_is_employee_self(uuid, uuid) IS
  'True if p_employee_id is the current user''s employee row in p_org_id.';

-- Execution scoping: shift owner OR explicit run-item assignee (COALESCE path matches mutate RPC).
CREATE OR REPLACE FUNCTION public.hh_user_can_access_run_item(p_org_id uuid, p_run_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.hh_is_org_member(auth.uid(), p_org_id) THEN false
    WHEN public.hh_is_org_manager(auth.uid(), p_org_id) THEN true
    WHEN public.hh_current_employee_id(p_org_id) IS NULL THEN false
    ELSE EXISTS (
      SELECT 1
      FROM public.shift_checklist_run_items ri
      JOIN public.shift_checklist_runs r ON r.id = ri.shift_checklist_run_id
      JOIN public.employee_shifts es ON es.id = r.employee_shift_id
      WHERE
        ri.id = p_run_item_id
        AND r.organization_id = p_org_id
        AND (
          es.employee_id = public.hh_current_employee_id(p_org_id)
          OR ri.assigned_employee_id = public.hh_current_employee_id(p_org_id)
        )
    )
  END;
$$;

COMMENT ON FUNCTION public.hh_user_can_access_run_item(uuid, uuid) IS
  'Manager: true. Employee: run item belongs to their shift or is assigned to them.';

CREATE OR REPLACE FUNCTION public.hh_employee_can_read_announcement(p_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_announcements a
    WHERE
      a.id = p_announcement_id
      AND public.hh_is_org_member(auth.uid(), a.organization_id)
      AND NOT public.hh_is_org_manager(auth.uid(), a.organization_id)
      AND (a.starts_at IS NULL OR a.starts_at <= now())
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND public.hh_current_employee_id(a.organization_id) IS NOT NULL
      AND (
        (
          a.employee_id IS NULL
          AND a.location_id IS NULL
        )
        OR (
          a.employee_id = public.hh_current_employee_id(a.organization_id)
        )
        OR (
          a.location_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.employees e
            WHERE
              e.id = public.hh_current_employee_id(a.organization_id)
              AND e.location_id IS NOT DISTINCT FROM a.location_id
          )
        )
      )
  );
$$;

COMMENT ON FUNCTION public.hh_employee_can_read_announcement(uuid) IS
  'Non-managers only: targeted + active-window visibility for employee_announcements.';

REVOKE ALL ON FUNCTION public.hh_is_org_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hh_is_org_manager(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hh_current_employee_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hh_is_employee_self(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hh_user_can_access_run_item(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hh_employee_can_read_announcement(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.hh_is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_is_org_manager(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_current_employee_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_is_employee_self(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_user_can_access_run_item(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hh_employee_can_read_announcement(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) DROP permissive policies (20260401000000 + performance + events + workforce)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS employee_announcements_select_member ON public.employee_announcements;
DROP POLICY IF EXISTS employee_announcements_write_manager ON public.employee_announcements;

DROP POLICY IF EXISTS employee_announcement_reads_select ON public.employee_announcement_reads;
DROP POLICY IF EXISTS employee_announcement_reads_insert_self ON public.employee_announcement_reads;
DROP POLICY IF EXISTS employee_announcement_reads_delete_manager ON public.employee_announcement_reads;

DROP POLICY IF EXISTS shift_checklist_run_item_notes_select_member ON public.shift_checklist_run_item_notes;
DROP POLICY IF EXISTS shift_checklist_run_item_notes_insert_member ON public.shift_checklist_run_item_notes;

DROP POLICY IF EXISTS shift_checklist_run_item_help_select_member ON public.shift_checklist_run_item_help_requests;
DROP POLICY IF EXISTS shift_checklist_run_item_help_insert_member ON public.shift_checklist_run_item_help_requests;
DROP POLICY IF EXISTS shift_checklist_run_item_help_update_member ON public.shift_checklist_run_item_help_requests;

DROP POLICY IF EXISTS shift_checklist_run_item_problems_select_member ON public.shift_checklist_run_item_problems;
DROP POLICY IF EXISTS shift_checklist_run_item_problems_insert_member ON public.shift_checklist_run_item_problems;
DROP POLICY IF EXISTS shift_checklist_run_item_problems_update_member ON public.shift_checklist_run_item_problems;

DROP POLICY IF EXISTS shift_logs_select_member ON public.shift_logs;
DROP POLICY IF EXISTS shift_logs_insert_authenticated ON public.shift_logs;
DROP POLICY IF EXISTS shift_logs_update_manager ON public.shift_logs;
DROP POLICY IF EXISTS shift_logs_delete_manager ON public.shift_logs;

DROP POLICY IF EXISTS issues_select_member ON public.issues;
DROP POLICY IF EXISTS issues_insert_member ON public.issues;
DROP POLICY IF EXISTS issues_update_member ON public.issues;
DROP POLICY IF EXISTS issues_delete_manager ON public.issues;

DROP POLICY IF EXISTS employee_performance_daily_select ON public.employee_performance_daily;
DROP POLICY IF EXISTS employee_performance_daily_write_manager ON public.employee_performance_daily;
DROP POLICY IF EXISTS location_performance_daily_select ON public.location_performance_daily;
DROP POLICY IF EXISTS location_performance_daily_write_manager ON public.location_performance_daily;

DROP POLICY IF EXISTS shift_checklist_run_item_events_select_member ON public.shift_checklist_run_item_events;

DROP POLICY IF EXISTS shift_task_transfer_requests_select ON public.shift_task_transfer_requests;
DROP POLICY IF EXISTS shift_task_transfer_requests_insert ON public.shift_task_transfer_requests;
DROP POLICY IF EXISTS shift_task_transfer_requests_update ON public.shift_task_transfer_requests;

DROP POLICY IF EXISTS shift_coverage_requests_select ON public.shift_coverage_requests;
DROP POLICY IF EXISTS shift_coverage_requests_insert ON public.shift_coverage_requests;
DROP POLICY IF EXISTS shift_coverage_requests_update ON public.shift_coverage_requests;

DROP POLICY IF EXISTS shift_trade_offers_select ON public.shift_trade_offers;
DROP POLICY IF EXISTS shift_trade_offers_insert ON public.shift_trade_offers;
DROP POLICY IF EXISTS shift_trade_offers_update ON public.shift_trade_offers;

-- ---------------------------------------------------------------------------
-- 3) employee_announcements
-- ---------------------------------------------------------------------------

CREATE POLICY employee_announcements_select
  ON public.employee_announcements FOR SELECT TO authenticated
  USING (
    public.hh_is_org_member(auth.uid(), organization_id)
    AND (
      public.hh_is_org_manager(auth.uid(), organization_id)
      OR public.hh_employee_can_read_announcement(id)
    )
  );

CREATE POLICY employee_announcements_insert_manager
  ON public.employee_announcements FOR INSERT TO authenticated
  WITH CHECK (public.hh_is_org_manager(auth.uid(), organization_id));

CREATE POLICY employee_announcements_update_manager
  ON public.employee_announcements FOR UPDATE TO authenticated
  USING (public.hh_is_org_manager(auth.uid(), organization_id))
  WITH CHECK (public.hh_is_org_manager(auth.uid(), organization_id));

CREATE POLICY employee_announcements_delete_manager
  ON public.employee_announcements FOR DELETE TO authenticated
  USING (public.hh_is_org_manager(auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- 4) employee_announcement_reads
-- ---------------------------------------------------------------------------

CREATE POLICY employee_announcement_reads_select
  ON public.employee_announcement_reads FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employee_announcements a
      WHERE
        a.id = employee_announcement_reads.announcement_id
        AND (
          public.hh_is_org_manager(auth.uid(), a.organization_id)
          OR employee_announcement_reads.employee_id = public.hh_current_employee_id(a.organization_id)
        )
    )
  );

CREATE POLICY employee_announcement_reads_insert_self
  ON public.employee_announcement_reads FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.hh_current_employee_id(
      (
        SELECT a.organization_id
        FROM public.employee_announcements a
        WHERE a.id = announcement_id
      )
    )
    AND public.hh_employee_can_read_announcement(announcement_id)
  );

CREATE POLICY employee_announcement_reads_delete_manager
  ON public.employee_announcement_reads FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employee_announcements a
      WHERE
        a.id = employee_announcement_reads.announcement_id
        AND public.hh_is_org_manager(auth.uid(), a.organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 5) shift_checklist_run_item_notes
-- ---------------------------------------------------------------------------

CREATE POLICY shift_checklist_run_item_notes_select
  ON public.shift_checklist_run_item_notes FOR SELECT TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR public.hh_user_can_access_run_item(organization_id, run_item_id)
  );

CREATE POLICY shift_checklist_run_item_notes_insert
  ON public.shift_checklist_run_item_notes FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = public.hh_current_employee_id(organization_id)
    AND public.hh_user_can_access_run_item(organization_id, run_item_id)
    AND organization_id IN (
      SELECT r.organization_id
      FROM public.shift_checklist_run_items ri
      JOIN public.shift_checklist_runs r ON r.id = ri.shift_checklist_run_id
      WHERE ri.id = run_item_id
    )
  );

-- No UPDATE/DELETE: append-only operational log

-- ---------------------------------------------------------------------------
-- 6) shift_checklist_run_item_events (SELECT only for clients; writes via RPC/service_role)
-- ---------------------------------------------------------------------------

CREATE POLICY shift_checklist_run_item_events_select
  ON public.shift_checklist_run_item_events FOR SELECT TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR public.hh_user_can_access_run_item(organization_id, shift_checklist_run_item_id)
  );

-- GRANTs: keep INSERT/UPDATE/DELETE revoked on events for authenticated (31210000)

-- ---------------------------------------------------------------------------
-- 7) shift_checklist_run_item_help_requests
-- ---------------------------------------------------------------------------

CREATE POLICY shift_checklist_run_item_help_requests_select
  ON public.shift_checklist_run_item_help_requests FOR SELECT TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR public.hh_user_can_access_run_item(organization_id, run_item_id)
    OR requested_by = public.hh_current_employee_id(organization_id)
    OR assigned_to IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
  );

CREATE POLICY shift_checklist_run_item_help_requests_insert
  ON public.shift_checklist_run_item_help_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = public.hh_current_employee_id(organization_id)
    AND public.hh_user_can_access_run_item(organization_id, run_item_id)
    AND organization_id IN (
      SELECT r.organization_id
      FROM public.shift_checklist_run_items ri
      JOIN public.shift_checklist_runs r ON r.id = ri.shift_checklist_run_id
      WHERE ri.id = run_item_id
    )
  );

CREATE POLICY shift_checklist_run_item_help_requests_update
  ON public.shift_checklist_run_item_help_requests FOR UPDATE TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR requested_by = public.hh_current_employee_id(organization_id)
    OR assigned_to IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.shift_checklist_run_item_help_requests h
      WHERE h.id = shift_checklist_run_item_help_requests.id
    )
  );

-- ---------------------------------------------------------------------------
-- 8) shift_checklist_run_item_problems
-- ---------------------------------------------------------------------------

CREATE POLICY shift_checklist_run_item_problems_select
  ON public.shift_checklist_run_item_problems FOR SELECT TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR public.hh_user_can_access_run_item(organization_id, run_item_id)
    OR reported_by = public.hh_current_employee_id(organization_id)
  );

CREATE POLICY shift_checklist_run_item_problems_insert
  ON public.shift_checklist_run_item_problems FOR INSERT TO authenticated
  WITH CHECK (
    reported_by = public.hh_current_employee_id(organization_id)
    AND public.hh_user_can_access_run_item(organization_id, run_item_id)
    AND organization_id IN (
      SELECT r.organization_id
      FROM public.shift_checklist_run_items ri
      JOIN public.shift_checklist_runs r ON r.id = ri.shift_checklist_run_id
      WHERE ri.id = run_item_id
    )
  );

CREATE POLICY shift_checklist_run_item_problems_update
  ON public.shift_checklist_run_item_problems FOR UPDATE TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR reported_by = public.hh_current_employee_id(organization_id)
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.shift_checklist_run_item_problems p
      WHERE p.id = shift_checklist_run_item_problems.id
    )
  );

-- ---------------------------------------------------------------------------
-- 9) shift_logs
-- ---------------------------------------------------------------------------

CREATE POLICY shift_logs_select
  ON public.shift_logs FOR SELECT TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR (
      public.hh_is_org_member(auth.uid(), organization_id)
      AND (
        created_by = auth.uid()
        OR employee_id IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
        OR (
          shift_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.employee_shifts es
            WHERE
              es.id = shift_logs.shift_id
              AND es.organization_id = shift_logs.organization_id
              AND es.employee_id = public.hh_current_employee_id(organization_id)
          )
        )
      )
    )
  );

CREATE POLICY shift_logs_insert
  ON public.shift_logs FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_is_org_member(auth.uid(), organization_id)
    AND created_by = auth.uid()
    AND (
      public.hh_is_org_manager(auth.uid(), organization_id)
      OR EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE
          e.id = public.hh_current_employee_id(organization_id)
          AND e.location_id IS NOT DISTINCT FROM shift_logs.location_id
      )
    )
  );

CREATE POLICY shift_logs_update_manager
  ON public.shift_logs FOR UPDATE TO authenticated
  USING (public.hh_is_org_manager(auth.uid(), organization_id))
  WITH CHECK (public.hh_is_org_manager(auth.uid(), organization_id));

CREATE POLICY shift_logs_delete_manager
  ON public.shift_logs FOR DELETE TO authenticated
  USING (public.hh_is_org_manager(auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- 10) issues
-- ---------------------------------------------------------------------------

CREATE POLICY issues_select
  ON public.issues FOR SELECT TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR (
      public.hh_is_org_member(auth.uid(), organization_id)
      AND (
        reported_by IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
        OR assigned_to IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
        OR (
          shift_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.employee_shifts es
            WHERE
              es.id = issues.shift_id
              AND es.organization_id = issues.organization_id
              AND es.employee_id = public.hh_current_employee_id(organization_id)
          )
        )
      )
    )
  );

CREATE POLICY issues_insert
  ON public.issues FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_is_org_member(auth.uid(), organization_id)
    AND (
      public.hh_is_org_manager(auth.uid(), organization_id)
      OR (
        reported_by IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
        AND reported_by IS NOT NULL
      )
    )
  );

CREATE POLICY issues_update
  ON public.issues FOR UPDATE TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR reported_by IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
    OR assigned_to IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.issues i
      WHERE i.id = issues.id
    )
  );

CREATE POLICY issues_delete_manager
  ON public.issues FOR DELETE TO authenticated
  USING (public.hh_is_org_manager(auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- 11) employee_performance_daily (employee sees own row only)
-- ---------------------------------------------------------------------------

CREATE POLICY employee_performance_daily_select
  ON public.employee_performance_daily FOR SELECT TO authenticated
  USING (
    public.hh_is_org_member(auth.uid(), organization_id)
    AND (
      public.hh_is_org_manager(auth.uid(), organization_id)
      OR employee_id = public.hh_current_employee_id(organization_id)
    )
  );

CREATE POLICY employee_performance_daily_insert_manager
  ON public.employee_performance_daily FOR INSERT TO authenticated
  WITH CHECK (public.hh_is_org_manager(auth.uid(), organization_id));

CREATE POLICY employee_performance_daily_update_manager
  ON public.employee_performance_daily FOR UPDATE TO authenticated
  USING (public.hh_is_org_manager(auth.uid(), organization_id))
  WITH CHECK (public.hh_is_org_manager(auth.uid(), organization_id));

CREATE POLICY employee_performance_daily_delete_manager
  ON public.employee_performance_daily FOR DELETE TO authenticated
  USING (public.hh_is_org_manager(auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- 12) location_performance_daily — managers only (aggregates are not employee-minimum)
-- ---------------------------------------------------------------------------

CREATE POLICY location_performance_daily_select_manager
  ON public.location_performance_daily FOR SELECT TO authenticated
  USING (public.hh_is_org_manager(auth.uid(), organization_id));

CREATE POLICY location_performance_daily_insert_manager
  ON public.location_performance_daily FOR INSERT TO authenticated
  WITH CHECK (public.hh_is_org_manager(auth.uid(), organization_id));

CREATE POLICY location_performance_daily_update_manager
  ON public.location_performance_daily FOR UPDATE TO authenticated
  USING (public.hh_is_org_manager(auth.uid(), organization_id))
  WITH CHECK (public.hh_is_org_manager(auth.uid(), organization_id));

CREATE POLICY location_performance_daily_delete_manager
  ON public.location_performance_daily FOR DELETE TO authenticated
  USING (public.hh_is_org_manager(auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- 13) Workforce request tables — same party+manager model; explicit names
--     Open-shift pickup: no separate table; rows live in shift_coverage_requests (open_claim).
--     Tighter “eligible claimer” visibility needs RPC (not expressible without eligibility rules).
-- ---------------------------------------------------------------------------

CREATE POLICY shift_task_transfer_requests_select
  ON public.shift_task_transfer_requests FOR SELECT TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR from_employee_id = public.hh_current_employee_id(organization_id)
    OR to_employee_id IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
    OR requested_by_employee_id IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
  );

CREATE POLICY shift_task_transfer_requests_insert
  ON public.shift_task_transfer_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR from_employee_id = public.hh_current_employee_id(organization_id)
    OR requested_by_employee_id IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
  );

CREATE POLICY shift_task_transfer_requests_update
  ON public.shift_task_transfer_requests FOR UPDATE TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR from_employee_id = public.hh_current_employee_id(organization_id)
    OR to_employee_id IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.shift_task_transfer_requests t
      WHERE t.id = shift_task_transfer_requests.id
    )
  );

CREATE POLICY shift_coverage_requests_select
  ON public.shift_coverage_requests FOR SELECT TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR requested_by_employee_id = public.hh_current_employee_id(organization_id)
    OR claimed_by_employee_id IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
    OR target_employee_id IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
  );

CREATE POLICY shift_coverage_requests_insert
  ON public.shift_coverage_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR requested_by_employee_id = public.hh_current_employee_id(organization_id)
  );

CREATE POLICY shift_coverage_requests_update
  ON public.shift_coverage_requests FOR UPDATE TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR requested_by_employee_id = public.hh_current_employee_id(organization_id)
    OR claimed_by_employee_id IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.shift_coverage_requests c
      WHERE c.id = shift_coverage_requests.id
    )
  );

CREATE POLICY shift_trade_offers_select
  ON public.shift_trade_offers FOR SELECT TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR offering_employee_id = public.hh_current_employee_id(organization_id)
    OR target_employee_id IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
    OR accepted_by_employee_id IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
  );

CREATE POLICY shift_trade_offers_insert
  ON public.shift_trade_offers FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR offering_employee_id = public.hh_current_employee_id(organization_id)
  );

CREATE POLICY shift_trade_offers_update
  ON public.shift_trade_offers FOR UPDATE TO authenticated
  USING (
    public.hh_is_org_manager(auth.uid(), organization_id)
    OR offering_employee_id = public.hh_current_employee_id(organization_id)
    OR target_employee_id IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
    OR accepted_by_employee_id IS NOT DISTINCT FROM public.hh_current_employee_id(organization_id)
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM public.shift_trade_offers t
      WHERE t.id = shift_trade_offers.id
    )
  );
