-- Template builder: optional section + duration hints on checklist lines.
-- Run review: optional proof object path (private bucket); app resolves signed URL when implemented.

ALTER TABLE public.checklist_items
  ADD COLUMN IF NOT EXISTS section_title text,
  ADD COLUMN IF NOT EXISTS duration_estimate_minutes integer;

ALTER TABLE public.shift_checklist_run_items
  ADD COLUMN IF NOT EXISTS proof_photo_storage_path text;

COMMENT ON COLUMN public.checklist_items.section_title IS 'Optional grouping label for template UI and manager scan; order is still sort_order.';
COMMENT ON COLUMN public.checklist_items.duration_estimate_minutes IS 'Advisory minutes for staffing; not enforced.';
COMMENT ON COLUMN public.shift_checklist_run_items.proof_photo_storage_path IS 'Storage object path when employee submits photo proof; TODO signed URL in app.';
