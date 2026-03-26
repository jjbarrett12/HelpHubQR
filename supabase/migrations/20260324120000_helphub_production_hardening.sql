-- Production hardening: org creation RPC, message idempotency, shift FK consistency, cron query index

-- ---------------------------------------------------------------------------
-- 1) Organizations: remove open INSERT; create atomic org + owner bootstrap RPC
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS organizations_insert_authenticated ON public.organizations;

REVOKE INSERT ON public.organizations FROM authenticated;

CREATE OR REPLACE FUNCTION public.hh_create_organization(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  new_id uuid;
BEGIN
  v_name := trim(p_name);
  IF v_name IS NULL OR length(v_name) < 1 THEN
    RAISE EXCEPTION 'invalid_organization_name';
  END IF;
  IF length(v_name) > 500 THEN
    RAISE EXCEPTION 'invalid_organization_name';
  END IF;

  INSERT INTO public.organizations (name) VALUES (v_name) RETURNING id INTO new_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
  VALUES (new_id, auth.uid(), 'owner', true);

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_create_organization(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_create_organization(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) Message deliveries: unique idempotency key (cron + non-resend manual)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS message_deliveries_idempotency_key_uidx
  ON public.message_deliveries (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3) Employee shifts: enforce employee / role / location belong to same org
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_employee_shifts_org_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = NEW.employee_id AND e.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'employee does not belong to this organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.staff_roles r
    WHERE r.id = NEW.staff_role_id AND r.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'staff role does not belong to this organization';
  END IF;

  IF NEW.location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.id = NEW.location_id AND l.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'location does not belong to this organization';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_employee_shifts_org_consistency() FROM PUBLIC;

DROP TRIGGER IF EXISTS employee_shifts_org_consistency ON public.employee_shifts;
CREATE TRIGGER employee_shifts_org_consistency
  BEFORE INSERT OR UPDATE OF employee_id, staff_role_id, location_id, organization_id
  ON public.employee_shifts
  FOR EACH ROW
  EXECUTE PROCEDURE public.hh_employee_shifts_org_consistency();

-- ---------------------------------------------------------------------------
-- 4) Cron / dashboard: partial index for "today's scheduled shifts"
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS employee_shifts_shift_date_scheduled_idx
  ON public.employee_shifts (shift_date)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS shift_checklist_runs_org_updated_idx
  ON public.shift_checklist_runs (organization_id, updated_at DESC);
