-- Analytics snapshots (NOT execution truth). Recomputable from operational tables.
-- Populated by scheduled jobs / materialization; RLS keeps employee rows private where noted.

-- ---------------------------------------------------------------------------
-- 9) employee_performance_daily
-- ---------------------------------------------------------------------------
CREATE TABLE public.employee_performance_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations (id) ON DELETE SET NULL,
  service_date date NOT NULL,
  tasks_assigned integer NOT NULL DEFAULT 0 CHECK (tasks_assigned >= 0),
  tasks_completed integer NOT NULL DEFAULT 0 CHECK (tasks_completed >= 0),
  tasks_completed_late integer NOT NULL DEFAULT 0 CHECK (tasks_completed_late >= 0),
  tasks_missing_proof integer NOT NULL DEFAULT 0 CHECK (tasks_missing_proof >= 0),
  help_requests_made integer NOT NULL DEFAULT 0 CHECK (help_requests_made >= 0),
  help_requests_resolved integer NOT NULL DEFAULT 0 CHECK (help_requests_resolved >= 0),
  problems_reported integer NOT NULL DEFAULT 0 CHECK (problems_reported >= 0),
  open_shifts_picked_up integer NOT NULL DEFAULT 0 CHECK (open_shifts_picked_up >= 0),
  coverage_requests_made integer NOT NULL DEFAULT 0 CHECK (coverage_requests_made >= 0),
  late_shifts integer NOT NULL DEFAULT 0 CHECK (late_shifts >= 0),
  no_shows integer NOT NULL DEFAULT 0 CHECK (no_shows >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_id, service_date)
);

CREATE INDEX employee_performance_daily_org_date_idx
  ON public.employee_performance_daily (organization_id, service_date DESC);
CREATE INDEX employee_performance_daily_employee_date_idx
  ON public.employee_performance_daily (employee_id, service_date DESC);

COMMENT ON TABLE public.employee_performance_daily IS
  'Advisory daily rollup per employee. Fairness/scoreboard input only — not authoritative for payroll or discipline.';

-- ---------------------------------------------------------------------------
-- 10) location_performance_daily
-- ---------------------------------------------------------------------------
CREATE TABLE public.location_performance_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations (id) ON DELETE CASCADE,
  service_date date NOT NULL,
  active_employees integer NOT NULL DEFAULT 0 CHECK (active_employees >= 0),
  tasks_assigned integer NOT NULL DEFAULT 0 CHECK (tasks_assigned >= 0),
  tasks_completed integer NOT NULL DEFAULT 0 CHECK (tasks_completed >= 0),
  tasks_completed_late integer NOT NULL DEFAULT 0 CHECK (tasks_completed_late >= 0),
  issues_opened integer NOT NULL DEFAULT 0 CHECK (issues_opened >= 0),
  issues_resolved integer NOT NULL DEFAULT 0 CHECK (issues_resolved >= 0),
  help_requests_open integer NOT NULL DEFAULT 0 CHECK (help_requests_open >= 0),
  problems_open integer NOT NULL DEFAULT 0 CHECK (problems_open >= 0),
  shift_logs_count integer NOT NULL DEFAULT 0 CHECK (shift_logs_count >= 0),
  coverage_requests_made integer NOT NULL DEFAULT 0 CHECK (coverage_requests_made >= 0),
  open_shifts_filled integer NOT NULL DEFAULT 0 CHECK (open_shifts_filled >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, location_id, service_date)
);

CREATE INDEX location_performance_daily_org_date_idx
  ON public.location_performance_daily (organization_id, service_date DESC);
CREATE INDEX location_performance_daily_location_date_idx
  ON public.location_performance_daily (location_id, service_date DESC);

COMMENT ON TABLE public.location_performance_daily IS
  'Advisory daily aggregate per location for manager/scoreboard views. Snapshot only.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.employee_performance_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_performance_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_performance_daily_select
  ON public.employee_performance_daily FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT public.hh_org_ids_for_user(auth.uid()))
    AND (
      public.hh_user_can_manage_org(auth.uid(), organization_id)
      OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
    )
  );

CREATE POLICY employee_performance_daily_write_manager
  ON public.employee_performance_daily FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY location_performance_daily_select
  ON public.location_performance_daily FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.hh_org_ids_for_user(auth.uid())));

CREATE POLICY location_performance_daily_write_manager
  ON public.location_performance_daily FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

REVOKE ALL ON public.employee_performance_daily FROM anon;
REVOKE ALL ON public.location_performance_daily FROM anon;

GRANT SELECT ON public.employee_performance_daily TO authenticated;
GRANT SELECT ON public.location_performance_daily TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_performance_daily TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_performance_daily TO authenticated;

-- Note: GRANT ALL for manager-only writes is approximated by RLS (employees lack manage role).
