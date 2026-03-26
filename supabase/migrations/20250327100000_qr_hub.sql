-- QR hub: destinations (content types) and printable QR codes. Public access via server-side slug lookup only.

CREATE TABLE public.qr_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations (id) ON DELETE SET NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (
    type IN (
      'checklist',
      'training',
      'sop',
      'issue_report',
      'announcement',
      'help'
    )
  ),
  target_checklist_id uuid REFERENCES public.checklists (id) ON DELETE SET NULL,
  content jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX qr_destinations_organization_id_idx ON public.qr_destinations (organization_id);
CREATE INDEX qr_destinations_location_id_idx ON public.qr_destinations (location_id);
CREATE INDEX qr_destinations_type_idx ON public.qr_destinations (organization_id, type);

CREATE TRIGGER qr_destinations_set_updated_at
  BEFORE UPDATE ON public.qr_destinations
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

CREATE TABLE public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations (id) ON DELETE SET NULL,
  qr_destination_id uuid NOT NULL REFERENCES public.qr_destinations (id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX qr_codes_organization_id_idx ON public.qr_codes (organization_id);
CREATE INDEX qr_codes_destination_id_idx ON public.qr_codes (qr_destination_id);

CREATE TRIGGER qr_codes_set_updated_at
  BEFORE UPDATE ON public.qr_codes
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

CREATE TABLE public.qr_issue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  qr_code_id uuid NOT NULL REFERENCES public.qr_codes (id) ON DELETE CASCADE,
  message text NOT NULL,
  contact text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX qr_issue_reports_organization_id_idx ON public.qr_issue_reports (organization_id);
CREATE INDEX qr_issue_reports_qr_code_id_idx ON public.qr_issue_reports (qr_code_id);

ALTER TABLE public.qr_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_issue_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY qr_destinations_select_manager
  ON public.qr_destinations FOR SELECT TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY qr_destinations_write_manager
  ON public.qr_destinations FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY qr_codes_select_manager
  ON public.qr_codes FOR SELECT TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY qr_codes_write_manager
  ON public.qr_codes FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY qr_issue_reports_select_manager
  ON public.qr_issue_reports FOR SELECT TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

REVOKE ALL ON public.qr_destinations FROM anon;
REVOKE ALL ON public.qr_codes FROM anon;
REVOKE ALL ON public.qr_issue_reports FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_destinations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_codes TO authenticated;
GRANT SELECT ON public.qr_issue_reports TO authenticated;
