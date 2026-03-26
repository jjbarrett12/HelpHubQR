-- Checklist link delivery via SMS (Twilio) / email; audit log per attempt.

CREATE TABLE public.organization_delivery_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations (id) ON DELETE CASCADE,
  send_sms boolean NOT NULL DEFAULT true,
  send_email boolean NOT NULL DEFAULT false,
  sms_from_number text,
  reply_to_email text,
  default_send_offset_minutes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER organization_delivery_settings_set_updated_at
  BEFORE UPDATE ON public.organization_delivery_settings
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

CREATE INDEX organization_delivery_settings_org_idx ON public.organization_delivery_settings (organization_id);

CREATE TABLE public.message_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  shift_checklist_run_id uuid NOT NULL REFERENCES public.shift_checklist_runs (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('sms', 'email')),
  destination text NOT NULL,
  provider text,
  provider_message_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  delivery_trigger text NOT NULL DEFAULT 'manual' CHECK (delivery_trigger IN ('cron', 'manual')),
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX message_deliveries_org_idx ON public.message_deliveries (organization_id);
CREATE INDEX message_deliveries_run_idx ON public.message_deliveries (shift_checklist_run_id);
CREATE INDEX message_deliveries_employee_idx ON public.message_deliveries (employee_id);
CREATE INDEX message_deliveries_status_idx ON public.message_deliveries (status);
CREATE INDEX message_deliveries_idempotency_idx ON public.message_deliveries (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TRIGGER message_deliveries_set_updated_at
  BEFORE UPDATE ON public.message_deliveries
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

ALTER TABLE public.organization_delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_delivery_settings_select_manager
  ON public.organization_delivery_settings FOR SELECT TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY organization_delivery_settings_write_manager
  ON public.organization_delivery_settings FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY message_deliveries_select_manager
  ON public.message_deliveries FOR SELECT TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY message_deliveries_insert_manager
  ON public.message_deliveries FOR INSERT TO authenticated
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

CREATE POLICY message_deliveries_update_manager
  ON public.message_deliveries FOR UPDATE TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

REVOKE ALL ON public.organization_delivery_settings FROM anon;
REVOKE ALL ON public.message_deliveries FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_delivery_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_deliveries TO authenticated;
