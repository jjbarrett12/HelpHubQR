-- Operational tables only: expose to Supabase Realtime (postgres_changes).
-- Clients use events as triggers to refetch canonical read models (e.g. hh_employee_today_bundle), not to patch UI from payloads.
-- RLS still applies to delivered rows.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shift_checklist_run_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_checklist_run_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shift_run_override_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_run_override_tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shift_checklist_run_item_escalations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_checklist_run_item_escalations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shift_run_override_task_escalations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_run_override_task_escalations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shift_notes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_notes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shift_checklist_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_checklist_runs;
  END IF;
END $$;
