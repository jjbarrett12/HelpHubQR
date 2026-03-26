-- Fairness + workforce logs: link ledger/events to shift_run_override_tasks for drill-down and parity with template run items.

ALTER TABLE public.fairness_assignment_ledger
  ADD COLUMN IF NOT EXISTS shift_run_override_task_id uuid REFERENCES public.shift_run_override_tasks (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS fairness_assignment_ledger_override_idx
  ON public.fairness_assignment_ledger (organization_id, shift_run_override_task_id)
  WHERE shift_run_override_task_id IS NOT NULL;

ALTER TABLE public.workforce_event_log
  ADD COLUMN IF NOT EXISTS shift_run_override_task_id uuid REFERENCES public.shift_run_override_tasks (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workforce_event_log_override_idx
  ON public.workforce_event_log (organization_id, shift_run_override_task_id)
  WHERE shift_run_override_task_id IS NOT NULL;
