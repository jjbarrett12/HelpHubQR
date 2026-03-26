-- Optional org-scoped task taxonomy (semantic metadata only; execution stays on checklist/run items).

-- ---------------------------------------------------------------------------
-- task_taxonomy
-- ---------------------------------------------------------------------------
CREATE TABLE public.task_taxonomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  task_key text NOT NULL,
  display_label text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_taxonomy_org_task_key_unique UNIQUE (organization_id, task_key)
);

CREATE INDEX task_taxonomy_organization_id_idx ON public.task_taxonomy (organization_id);
CREATE INDEX task_taxonomy_org_active_idx
  ON public.task_taxonomy (organization_id)
  WHERE is_active = true;

CREATE TRIGGER task_taxonomy_set_updated_at
  BEFORE UPDATE ON public.task_taxonomy
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

ALTER TABLE public.task_taxonomy ENABLE ROW LEVEL SECURITY;

-- Any org member may read taxonomy (labels for prefs / UI); managers write.
CREATE POLICY task_taxonomy_select_org_member
  ON public.task_taxonomy FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.hh_org_ids_for_user(auth.uid())));

CREATE POLICY task_taxonomy_insert_manager
  ON public.task_taxonomy FOR INSERT TO authenticated
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY task_taxonomy_update_manager
  ON public.task_taxonomy FOR UPDATE TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY task_taxonomy_delete_manager
  ON public.task_taxonomy FOR DELETE TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

REVOKE ALL ON public.task_taxonomy FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_taxonomy TO authenticated;

-- ---------------------------------------------------------------------------
-- Override tasks: semantic key snapshot (fairness / prefs alignment)
-- ---------------------------------------------------------------------------
ALTER TABLE public.shift_run_override_tasks
  ADD COLUMN IF NOT EXISTS task_key_snapshot text;

UPDATE public.shift_run_override_tasks o
SET task_key_snapshot = public.hh_normalize_task_key(o.task_text_snapshot)
WHERE o.task_key_snapshot IS NULL
  AND o.task_text_snapshot IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Import review rows: suggested / manager-chosen task key before commit
-- ---------------------------------------------------------------------------
ALTER TABLE public.imported_document_tasks
  ADD COLUMN IF NOT EXISTS task_key text;

-- ---------------------------------------------------------------------------
-- Prefer NULL checklist_items.task_key when it only mirrors normalized text
-- (explicit key vs derive-at-snapshot semantics in app)
-- ---------------------------------------------------------------------------
UPDATE public.checklist_items ci
SET task_key = NULL
WHERE ci.task_key IS NOT NULL
  AND ci.task_text IS NOT NULL
  AND public.hh_normalize_task_key(ci.task_key) = public.hh_normalize_task_key(ci.task_text);
