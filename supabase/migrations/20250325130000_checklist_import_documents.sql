-- Checklist import: photo/PDF-style sources → OCR + AI → review → live checklist
-- Storage bucket is private; app uploads/reads via service role after auth checks.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.imported_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  uploaded_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_filename text,
  mime_type text,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'review', 'completed', 'failed')),
  ocr_text text,
  ai_result jsonb,
  error_message text,
  ocr_confidence real,
  ai_confidence real,
  review_checklist_name text,
  review_shift_type text CHECK (review_shift_type IS NULL OR review_shift_type IN ('open', 'mid', 'close', 'custom')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX imported_documents_organization_id_idx ON public.imported_documents (organization_id);
CREATE INDEX imported_documents_status_idx ON public.imported_documents (status);
CREATE INDEX imported_documents_uploaded_by_idx ON public.imported_documents (uploaded_by_user_id);

CREATE TABLE public.imported_document_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_document_id uuid NOT NULL REFERENCES public.imported_documents (id) ON DELETE CASCADE,
  task_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_selected boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX imported_document_tasks_document_id_idx ON public.imported_document_tasks (imported_document_id);

CREATE TRIGGER imported_documents_set_updated_at
  BEFORE UPDATE ON public.imported_documents
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

CREATE TRIGGER imported_document_tasks_set_updated_at
  BEFORE UPDATE ON public.imported_document_tasks
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: only org managers (owner/manager/admin) may access import records
-- ---------------------------------------------------------------------------
ALTER TABLE public.imported_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imported_document_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY imported_documents_select_manager
  ON public.imported_documents FOR SELECT TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY imported_documents_insert_manager
  ON public.imported_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_user_can_manage_org(auth.uid(), organization_id)
    AND uploaded_by_user_id = auth.uid()
  );

CREATE POLICY imported_documents_update_manager
  ON public.imported_documents FOR UPDATE TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY imported_documents_delete_manager
  ON public.imported_documents FOR DELETE TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY imported_document_tasks_select_manager
  ON public.imported_document_tasks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.imported_documents d
      WHERE d.id = imported_document_tasks.imported_document_id
        AND public.hh_user_can_manage_org(auth.uid(), d.organization_id)
    )
  );

CREATE POLICY imported_document_tasks_insert_manager
  ON public.imported_document_tasks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.imported_documents d
      WHERE d.id = imported_document_tasks.imported_document_id
        AND public.hh_user_can_manage_org(auth.uid(), d.organization_id)
    )
  );

CREATE POLICY imported_document_tasks_update_manager
  ON public.imported_document_tasks FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.imported_documents d
      WHERE d.id = imported_document_tasks.imported_document_id
        AND public.hh_user_can_manage_org(auth.uid(), d.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.imported_documents d
      WHERE d.id = imported_document_tasks.imported_document_id
        AND public.hh_user_can_manage_org(auth.uid(), d.organization_id)
    )
  );

CREATE POLICY imported_document_tasks_delete_manager
  ON public.imported_document_tasks FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.imported_documents d
      WHERE d.id = imported_document_tasks.imported_document_id
        AND public.hh_user_can_manage_org(auth.uid(), d.organization_id)
    )
  );

REVOKE ALL ON public.imported_documents FROM anon;
REVOKE ALL ON public.imported_document_tasks FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.imported_document_tasks TO authenticated;

-- ---------------------------------------------------------------------------
-- Private storage bucket (no public read). App uses service role after auth.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checklist-imports',
  'checklist-imports',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;
