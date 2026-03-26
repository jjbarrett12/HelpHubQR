-- Fairness: SQL/JS key parity, employee self-delete on work prefs, ledger query indexes

-- ---------------------------------------------------------------------------
-- Align empty-task normalization with app (returns 'unnamed_task' like JS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_normalize_task_key(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(
      trim(both '_' from
        regexp_replace(
          regexp_replace(lower(trim(coalesce(raw, ''))), '[^a-z0-9]+', '_', 'g'),
          '_+', '_', 'g'
        )
      ),
      ''
    ),
    'unnamed_task'
  );
$$;

UPDATE public.checklist_items
SET task_key = public.hh_normalize_task_key(task_text)
WHERE task_key IS NULL OR task_key = '';

UPDATE public.shift_checklist_run_items ri
SET task_key_snapshot = COALESCE(ci.task_key, public.hh_normalize_task_key(ci.task_text))
FROM public.checklist_items ci
WHERE ri.checklist_item_id = ci.id
  AND (ri.task_key_snapshot IS NULL OR ri.task_key_snapshot = '');

UPDATE public.shift_checklist_run_items
SET task_key_snapshot = public.hh_normalize_task_key(task_text_snapshot)
WHERE task_key_snapshot IS NULL
  AND task_text_snapshot IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Employee can delete own work-preferences row (was manager-only)
-- ---------------------------------------------------------------------------
CREATE POLICY employee_work_preferences_delete_self
  ON public.employee_work_preferences FOR DELETE TO authenticated
  USING (employee_id = public.hh_employee_id_for_user(auth.uid(), organization_id));

-- ---------------------------------------------------------------------------
-- Ledger drill-down / ranking query support
-- (org+employee+created already exists as fairness_assignment_ledger_org_emp_created_idx)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS fairness_assignment_ledger_org_emp_key_created_idx
  ON public.fairness_assignment_ledger (organization_id, employee_id, preference_key, created_at DESC)
  WHERE preference_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS fairness_assignment_ledger_org_emp_event_created_idx
  ON public.fairness_assignment_ledger (organization_id, employee_id, event_type, created_at DESC);
