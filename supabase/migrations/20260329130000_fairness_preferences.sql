-- Preferences + fairness ledger (advisory + analytics). Additive only.

-- ---------------------------------------------------------------------------
-- Normalize task text to a stable key (matches app lib/helphub/fairness/task-key.ts)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_normalize_task_key(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    trim(both '_' from
      regexp_replace(
        regexp_replace(lower(trim(coalesce(raw, ''))), '[^a-z0-9]+', '_', 'g'),
        '_+', '_', 'g'
      )
    ),
    ''
  );
$$;

REVOKE ALL ON FUNCTION public.hh_normalize_task_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_normalize_task_key(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Template + run item keys (execution still from run items / templates)
-- ---------------------------------------------------------------------------
ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS task_key text;

ALTER TABLE public.shift_checklist_run_items
  ADD COLUMN IF NOT EXISTS task_key_snapshot text;

CREATE INDEX IF NOT EXISTS checklist_items_task_key_idx
  ON public.checklist_items (checklist_id, task_key)
  WHERE task_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS shift_checklist_run_items_task_key_idx
  ON public.shift_checklist_run_items (task_key_snapshot)
  WHERE task_key_snapshot IS NOT NULL;

UPDATE public.checklist_items
SET task_key = public.hh_normalize_task_key(task_text)
WHERE task_key IS NULL AND task_text IS NOT NULL;

UPDATE public.shift_checklist_run_items ri
SET task_key_snapshot = COALESCE(ci.task_key, public.hh_normalize_task_key(ci.task_text))
FROM public.checklist_items ci
WHERE ri.checklist_item_id = ci.id
  AND ri.task_key_snapshot IS NULL;

UPDATE public.shift_checklist_run_items
SET task_key_snapshot = public.hh_normalize_task_key(task_text_snapshot)
WHERE task_key_snapshot IS NULL AND task_text_snapshot IS NOT NULL;

-- ---------------------------------------------------------------------------
-- employee_task_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE public.employee_task_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  preference_key text NOT NULL,
  preference_label text,
  preference_level text NOT NULL CHECK (preference_level IN ('prefer', 'neutral', 'avoid')),
  created_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_id, preference_key)
);

CREATE INDEX employee_task_preferences_org_emp_idx
  ON public.employee_task_preferences (organization_id, employee_id);

CREATE TRIGGER employee_task_preferences_set_updated_at
  BEFORE UPDATE ON public.employee_task_preferences
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- employee_schedule_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE public.employee_schedule_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  weekday integer CHECK (weekday IS NULL OR (weekday >= 0 AND weekday <= 6)),
  shift_type text CHECK (shift_type IS NULL OR shift_type IN ('open', 'mid', 'close', 'custom')),
  preference_level text NOT NULL CHECK (preference_level IN ('prefer', 'available', 'avoid', 'unavailable')),
  created_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_schedule_preferences_dim_check CHECK (
    weekday IS NOT NULL OR shift_type IS NOT NULL
  )
);

CREATE UNIQUE INDEX employee_schedule_preferences_unique_slot
  ON public.employee_schedule_preferences (
    organization_id,
    employee_id,
    (COALESCE(weekday, -1)),
    (COALESCE(shift_type, ''))
  );

CREATE INDEX employee_schedule_preferences_org_emp_idx
  ON public.employee_schedule_preferences (organization_id, employee_id);

CREATE TRIGGER employee_schedule_preferences_set_updated_at
  BEFORE UPDATE ON public.employee_schedule_preferences
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- employee_work_preferences (one row per employee per org)
-- ---------------------------------------------------------------------------
CREATE TABLE public.employee_work_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  wants_extra_hours boolean NOT NULL DEFAULT false,
  open_to_same_day_coverage boolean NOT NULL DEFAULT false,
  open_to_weekend_shifts boolean NOT NULL DEFAULT false,
  prefers_consistent_schedule boolean NOT NULL DEFAULT false,
  max_shifts_per_week integer CHECK (max_shifts_per_week IS NULL OR max_shifts_per_week >= 0),
  max_hours_per_week numeric CHECK (max_hours_per_week IS NULL OR max_hours_per_week >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, employee_id)
);

CREATE TRIGGER employee_work_preferences_set_updated_at
  BEFORE UPDATE ON public.employee_work_preferences
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- fairness_assignment_ledger (analytics only; inserts via service role in app)
-- ---------------------------------------------------------------------------
CREATE TABLE public.fairness_assignment_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  employee_shift_id uuid REFERENCES public.employee_shifts (id) ON DELETE SET NULL,
  shift_checklist_run_id uuid REFERENCES public.shift_checklist_runs (id) ON DELETE SET NULL,
  shift_checklist_run_item_id uuid REFERENCES public.shift_checklist_run_items (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  fairness_category text NOT NULL,
  preference_key text,
  shift_type text,
  weekday integer,
  value numeric NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fairness_assignment_ledger_org_created_idx
  ON public.fairness_assignment_ledger (organization_id, created_at DESC);

CREATE INDEX fairness_assignment_ledger_org_emp_created_idx
  ON public.fairness_assignment_ledger (organization_id, employee_id, created_at DESC);

CREATE INDEX fairness_assignment_ledger_org_type_idx
  ON public.fairness_assignment_ledger (organization_id, event_type);

-- ---------------------------------------------------------------------------
-- organization_fairness_settings
-- ---------------------------------------------------------------------------
CREATE TABLE public.organization_fairness_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations (id) ON DELETE CASCADE,
  undesirable_shift_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  undesirable_weekdays jsonb NOT NULL DEFAULT '[]'::jsonb,
  undesirable_task_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  fairness_lookback_days integer NOT NULL DEFAULT 30 CHECK (fairness_lookback_days > 0 AND fairness_lookback_days <= 730),
  enable_fairness_warnings boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER organization_fairness_settings_set_updated_at
  BEFORE UPDATE ON public.organization_fairness_settings
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.employee_task_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_schedule_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_work_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fairness_assignment_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_fairness_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY employee_task_preferences_select
  ON public.employee_task_preferences FOR SELECT TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY employee_task_preferences_insert
  ON public.employee_task_preferences FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY employee_task_preferences_update
  ON public.employee_task_preferences FOR UPDATE TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  )
  WITH CHECK (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY employee_task_preferences_delete
  ON public.employee_task_preferences FOR DELETE TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY employee_schedule_preferences_select
  ON public.employee_schedule_preferences FOR SELECT TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY employee_schedule_preferences_insert
  ON public.employee_schedule_preferences FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY employee_schedule_preferences_update
  ON public.employee_schedule_preferences FOR UPDATE TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  )
  WITH CHECK (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY employee_schedule_preferences_delete
  ON public.employee_schedule_preferences FOR DELETE TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY employee_work_preferences_select
  ON public.employee_work_preferences FOR SELECT TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY employee_work_preferences_insert
  ON public.employee_work_preferences FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY employee_work_preferences_update
  ON public.employee_work_preferences FOR UPDATE TO authenticated
  USING (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  )
  WITH CHECK (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    OR employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id)
  );

CREATE POLICY employee_work_preferences_delete
  ON public.employee_work_preferences FOR DELETE TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY fairness_assignment_ledger_select_manager
  ON public.fairness_assignment_ledger FOR SELECT TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY organization_fairness_settings_select_manager
  ON public.organization_fairness_settings FOR SELECT TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY organization_fairness_settings_write_manager
  ON public.organization_fairness_settings FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.employee_task_preferences FROM anon;
REVOKE ALL ON public.employee_schedule_preferences FROM anon;
REVOKE ALL ON public.employee_work_preferences FROM anon;
REVOKE ALL ON public.fairness_assignment_ledger FROM anon;
REVOKE ALL ON public.organization_fairness_settings FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_task_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_schedule_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_work_preferences TO authenticated;
GRANT SELECT ON public.fairness_assignment_ledger TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_fairness_settings TO authenticated;
