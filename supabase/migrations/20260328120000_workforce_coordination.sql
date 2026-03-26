-- Workforce coordination: per-run task ownership, overrides, transfers, coverage, trades, audit log.
-- Additive only; backfills shift_checklist_run_items from template + shift employee.

-- ---------------------------------------------------------------------------
-- Link employees to auth users (optional) for /app/my-shifts workforce UX
-- ---------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS employees_auth_user_org_uidx
  ON public.employees (organization_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Open shift claiming (manager toggle)
-- ---------------------------------------------------------------------------
ALTER TABLE public.employee_shifts
  ADD COLUMN IF NOT EXISTS is_open_for_claim boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Extend shift_checklist_run_items
-- ---------------------------------------------------------------------------
ALTER TABLE public.shift_checklist_run_items
  ADD COLUMN IF NOT EXISTS task_text_snapshot text,
  ADD COLUMN IF NOT EXISTS assigned_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignment_status text NOT NULL DEFAULT 'assigned'
    CHECK (assignment_status IN ('assigned', 'offered', 'claimed', 'pending_approval', 'completed', 'declined')),
  ADD COLUMN IF NOT EXISTS suppressed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_source text NOT NULL DEFAULT 'template'
    CHECK (override_source IN ('template', 'manager_override', 'employee_request')),
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS reassigned_from_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reassigned_at timestamptz;

CREATE INDEX IF NOT EXISTS shift_checklist_run_items_assigned_employee_idx
  ON public.shift_checklist_run_items (assigned_employee_id);
CREATE INDEX IF NOT EXISTS shift_checklist_run_items_suppressed_idx
  ON public.shift_checklist_run_items (shift_checklist_run_id, suppressed);

-- Backfill snapshot + assignment from template + shift
UPDATE public.shift_checklist_run_items ri
SET
  task_text_snapshot = ci.task_text,
  assigned_employee_id = es.employee_id,
  override_source = 'template'
FROM public.shift_checklist_runs r
JOIN public.employee_shifts es ON es.id = r.employee_shift_id
JOIN public.checklist_items ci ON ci.id = ri.checklist_item_id
WHERE ri.shift_checklist_run_id = r.id
  AND (ri.task_text_snapshot IS NULL OR ri.assigned_employee_id IS NULL);

-- ---------------------------------------------------------------------------
-- organization_workforce_settings
-- ---------------------------------------------------------------------------
CREATE TABLE public.organization_workforce_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations (id) ON DELETE CASCADE,
  allow_employee_task_offers boolean NOT NULL DEFAULT true,
  allow_open_shift_claims boolean NOT NULL DEFAULT true,
  allow_shift_trades boolean NOT NULL DEFAULT true,
  manager_approval_required_for_task_transfer boolean NOT NULL DEFAULT true,
  manager_approval_required_for_shift_claim boolean NOT NULL DEFAULT true,
  manager_approval_required_for_shift_trade boolean NOT NULL DEFAULT true,
  allow_cross_role_claims boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER organization_workforce_settings_set_updated_at
  BEFORE UPDATE ON public.organization_workforce_settings
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- shift_run_override_tasks (one-off tasks for a run)
-- ---------------------------------------------------------------------------
CREATE TABLE public.shift_run_override_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.shift_checklist_runs (id) ON DELETE CASCADE,
  task_text_snapshot text NOT NULL,
  assigned_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suppressed', 'completed')),
  sort_order integer NOT NULL DEFAULT 0,
  requires_photo boolean NOT NULL DEFAULT false,
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shift_run_override_tasks_run_idx ON public.shift_run_override_tasks (run_id);
CREATE INDEX shift_run_override_tasks_org_idx ON public.shift_run_override_tasks (organization_id);

CREATE TRIGGER shift_run_override_tasks_set_updated_at
  BEFORE UPDATE ON public.shift_run_override_tasks
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- shift_task_transfer_requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.shift_task_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  shift_checklist_run_item_id uuid NOT NULL REFERENCES public.shift_checklist_run_items (id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.shift_checklist_runs (id) ON DELETE CASCADE,
  from_employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  to_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  request_mode text NOT NULL CHECK (request_mode IN ('direct', 'open_offer', 'manager_initiated')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'approved', 'denied', 'cancelled', 'expired')),
  requested_by_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  requested_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reason text,
  manager_approval_required boolean NOT NULL DEFAULT true,
  approved_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shift_task_transfer_requests_org_idx ON public.shift_task_transfer_requests (organization_id);
CREATE INDEX shift_task_transfer_requests_run_idx ON public.shift_task_transfer_requests (run_id);
CREATE INDEX shift_task_transfer_requests_status_idx ON public.shift_task_transfer_requests (organization_id, status);

CREATE TRIGGER shift_task_transfer_requests_set_updated_at
  BEFORE UPDATE ON public.shift_task_transfer_requests
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- shift_coverage_requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.shift_coverage_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_shift_id uuid NOT NULL REFERENCES public.employee_shifts (id) ON DELETE CASCADE,
  requested_by_employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('open_claim', 'direct_trade', 'direct_cover')),
  target_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'accepted', 'approved', 'denied', 'cancelled', 'expired')),
  reason text,
  claimed_by_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  manager_approval_required boolean NOT NULL DEFAULT true,
  approved_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shift_coverage_requests_org_idx ON public.shift_coverage_requests (organization_id);
CREATE INDEX shift_coverage_requests_shift_idx ON public.shift_coverage_requests (employee_shift_id);
CREATE INDEX shift_coverage_requests_status_idx ON public.shift_coverage_requests (organization_id, status);

CREATE TRIGGER shift_coverage_requests_set_updated_at
  BEFORE UPDATE ON public.shift_coverage_requests
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- shift_trade_offers
-- ---------------------------------------------------------------------------
CREATE TABLE public.shift_trade_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  offered_shift_id uuid NOT NULL REFERENCES public.employee_shifts (id) ON DELETE CASCADE,
  requested_shift_id uuid REFERENCES public.employee_shifts (id) ON DELETE SET NULL,
  offering_employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  target_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  accepted_by_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'approved', 'denied', 'cancelled', 'expired')),
  reason text,
  manager_approval_required boolean NOT NULL DEFAULT true,
  approved_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shift_trade_offers_org_idx ON public.shift_trade_offers (organization_id);
CREATE INDEX shift_trade_offers_offered_idx ON public.shift_trade_offers (offered_shift_id);
CREATE INDEX shift_trade_offers_status_idx ON public.shift_trade_offers (organization_id, status);

CREATE TRIGGER shift_trade_offers_set_updated_at
  BEFORE UPDATE ON public.shift_trade_offers
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- workforce_event_log
-- ---------------------------------------------------------------------------
CREATE TABLE public.workforce_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_employee_id uuid REFERENCES public.employees (id) ON DELETE SET NULL,
  employee_shift_id uuid REFERENCES public.employee_shifts (id) ON DELETE SET NULL,
  shift_checklist_run_id uuid REFERENCES public.shift_checklist_runs (id) ON DELETE SET NULL,
  shift_checklist_run_item_id uuid REFERENCES public.shift_checklist_run_items (id) ON DELETE SET NULL,
  related_request_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workforce_event_log_org_idx ON public.workforce_event_log (organization_id);
CREATE INDEX workforce_event_log_created_idx ON public.workforce_event_log (organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS helper: employee row for auth user in org
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_employee_id_for_user(uid uuid, org uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id
  FROM public.employees e
  WHERE e.auth_user_id IS NOT DISTINCT FROM uid
    AND e.organization_id = org
    AND e.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.hh_employee_id_for_user(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_employee_id_for_user(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS: organization_workforce_settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_workforce_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_workforce_settings_select_manager
  ON public.organization_workforce_settings FOR SELECT TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY organization_workforce_settings_write_manager
  ON public.organization_workforce_settings FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- RLS: shift_run_override_tasks
-- ---------------------------------------------------------------------------
ALTER TABLE public.shift_run_override_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY shift_run_override_tasks_select_member
  ON public.shift_run_override_tasks FOR SELECT TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR EXISTS (
      SELECT 1 FROM public.shift_checklist_runs r
      JOIN public.employee_shifts es ON es.id = r.employee_shift_id
      WHERE r.id = shift_run_override_tasks.run_id
        AND es.organization_id = shift_run_override_tasks.organization_id
        AND (
          es.employee_id = public.hh_employee_id_for_user(auth.uid(), shift_run_override_tasks.organization_id)
          OR shift_run_override_tasks.assigned_employee_id
            = public.hh_employee_id_for_user(auth.uid(), shift_run_override_tasks.organization_id)
        )
    )
  );

CREATE POLICY shift_run_override_tasks_write_manager
  ON public.shift_run_override_tasks FOR INSERT TO authenticated
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY shift_run_override_tasks_update_manager
  ON public.shift_run_override_tasks FOR UPDATE TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY shift_run_override_tasks_delete_manager
  ON public.shift_run_override_tasks FOR DELETE TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- RLS: shift_task_transfer_requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.shift_task_transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY shift_task_transfer_requests_select
  ON public.shift_task_transfer_requests FOR SELECT TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR from_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    OR to_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    OR requested_by_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY shift_task_transfer_requests_insert
  ON public.shift_task_transfer_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR from_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    OR requested_by_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY shift_task_transfer_requests_update
  ON public.shift_task_transfer_requests FOR UPDATE TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR from_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    OR to_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  )
  WITH CHECK (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR from_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    OR to_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: shift_coverage_requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.shift_coverage_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY shift_coverage_requests_select
  ON public.shift_coverage_requests FOR SELECT TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR requested_by_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    OR claimed_by_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    OR target_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY shift_coverage_requests_insert
  ON public.shift_coverage_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR requested_by_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY shift_coverage_requests_update
  ON public.shift_coverage_requests FOR UPDATE TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR requested_by_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    OR claimed_by_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: shift_trade_offers
-- ---------------------------------------------------------------------------
ALTER TABLE public.shift_trade_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY shift_trade_offers_select
  ON public.shift_trade_offers FOR SELECT TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR offering_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    OR target_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    OR accepted_by_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY shift_trade_offers_insert
  ON public.shift_trade_offers FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR offering_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY shift_trade_offers_update
  ON public.shift_trade_offers FOR UPDATE TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR offering_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    OR target_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    OR accepted_by_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: workforce_event_log
-- ---------------------------------------------------------------------------
ALTER TABLE public.workforce_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY workforce_event_log_select_manager
  ON public.workforce_event_log FOR SELECT TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY workforce_event_log_insert
  ON public.workforce_event_log FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR actor_employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

-- ---------------------------------------------------------------------------
-- Grants (anon none)
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.organization_workforce_settings FROM anon;
REVOKE ALL ON public.shift_run_override_tasks FROM anon;
REVOKE ALL ON public.shift_task_transfer_requests FROM anon;
REVOKE ALL ON public.shift_coverage_requests FROM anon;
REVOKE ALL ON public.shift_trade_offers FROM anon;
REVOKE ALL ON public.workforce_event_log FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_workforce_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_run_override_tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_task_transfer_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_coverage_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_trade_offers TO authenticated;
GRANT SELECT, INSERT ON public.workforce_event_log TO authenticated;
