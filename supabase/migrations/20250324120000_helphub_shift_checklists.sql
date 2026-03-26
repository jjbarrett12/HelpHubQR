-- HELPHUBQR V1: organizations, shift checklists, runs (tenant-isolated + RLS)
-- Public employee access uses server-side service role + token validation (not anon table access).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'manager', 'admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX organization_members_user_id_idx ON public.organization_members (user_id);
CREATE INDEX organization_members_org_id_idx ON public.organization_members (organization_id);

CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX locations_organization_id_idx ON public.locations (organization_id);

CREATE TABLE public.staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX staff_roles_organization_id_idx ON public.staff_roles (organization_id);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations (id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX employees_organization_id_idx ON public.employees (organization_id);
CREATE INDEX employees_location_id_idx ON public.employees (location_id);

CREATE TABLE public.employee_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  staff_role_id uuid NOT NULL REFERENCES public.staff_roles (id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, staff_role_id)
);

CREATE INDEX employee_role_assignments_org_idx ON public.employee_role_assignments (organization_id);
CREATE INDEX employee_role_assignments_employee_idx ON public.employee_role_assignments (employee_id);

CREATE TABLE public.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations (id) ON DELETE SET NULL,
  staff_role_id uuid NOT NULL REFERENCES public.staff_roles (id) ON DELETE CASCADE,
  shift_type text NOT NULL CHECK (shift_type IN ('open', 'mid', 'close', 'custom')),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX checklists_organization_id_idx ON public.checklists (organization_id);
CREATE INDEX checklists_staff_role_id_idx ON public.checklists (staff_role_id);
CREATE INDEX checklists_location_id_idx ON public.checklists (location_id);

CREATE TABLE public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.checklists (id) ON DELETE CASCADE,
  task_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  requires_photo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX checklist_items_checklist_id_idx ON public.checklist_items (checklist_id);

CREATE TABLE public.employee_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations (id) ON DELETE SET NULL,
  employee_id uuid NOT NULL REFERENCES public.employees (id) ON DELETE CASCADE,
  staff_role_id uuid NOT NULL REFERENCES public.staff_roles (id) ON DELETE CASCADE,
  shift_date date NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('open', 'mid', 'close', 'custom')),
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'in_progress', 'completed', 'missed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX employee_shifts_slot_idx
  ON public.employee_shifts (
    organization_id,
    employee_id,
    shift_date,
    shift_type,
    (COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid))
  );

CREATE INDEX employee_shifts_org_date_idx ON public.employee_shifts (organization_id, shift_date);
CREATE INDEX employee_shifts_employee_id_idx ON public.employee_shifts (employee_id);
CREATE INDEX employee_shifts_status_idx ON public.employee_shifts (status);

CREATE TABLE public.shift_checklist_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  employee_shift_id uuid NOT NULL UNIQUE REFERENCES public.employee_shifts (id) ON DELETE CASCADE,
  checklist_id uuid NOT NULL REFERENCES public.checklists (id) ON DELETE RESTRICT,
  access_token text NOT NULL UNIQUE,
  sent_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'completed', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shift_checklist_runs_organization_id_idx ON public.shift_checklist_runs (organization_id);
CREATE INDEX shift_checklist_runs_access_token_idx ON public.shift_checklist_runs (access_token);
CREATE INDEX shift_checklist_runs_status_idx ON public.shift_checklist_runs (status);

CREATE TABLE public.shift_checklist_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_checklist_run_id uuid NOT NULL REFERENCES public.shift_checklist_runs (id) ON DELETE CASCADE,
  checklist_item_id uuid NOT NULL REFERENCES public.checklist_items (id) ON DELETE RESTRICT,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shift_checklist_run_id, checklist_item_id)
);

CREATE INDEX shift_checklist_run_items_run_id_idx ON public.shift_checklist_run_items (shift_checklist_run_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

CREATE TRIGGER locations_set_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

CREATE TRIGGER staff_roles_set_updated_at
  BEFORE UPDATE ON public.staff_roles
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

CREATE TRIGGER employees_set_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

CREATE TRIGGER checklists_set_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

CREATE TRIGGER checklist_items_set_updated_at
  BEFORE UPDATE ON public.checklist_items
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

CREATE TRIGGER employee_shifts_set_updated_at
  BEFORE UPDATE ON public.employee_shifts
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

CREATE TRIGGER shift_checklist_runs_set_updated_at
  BEFORE UPDATE ON public.shift_checklist_runs
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

CREATE TRIGGER shift_checklist_run_items_set_updated_at
  BEFORE UPDATE ON public.shift_checklist_run_items
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS helpers (SECURITY DEFINER: avoid recursion in policies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_org_ids_for_user(uid uuid)
RETURNS TABLE (organization_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.organization_id
  FROM public.organization_members m
  WHERE m.user_id = uid AND m.is_active = true;
$$;

REVOKE ALL ON FUNCTION public.hh_org_ids_for_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_org_ids_for_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.hh_user_can_manage_org(uid uuid, org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.user_id = uid
      AND m.organization_id = org
      AND m.is_active = true
      AND m.role IN ('owner', 'manager', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.hh_user_can_manage_org(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_user_can_manage_org(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_checklist_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_checklist_run_items ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Policies: read for any active org member; write for owner/manager/admin
-- ---------------------------------------------------------------------------

-- organizations
CREATE POLICY organizations_select_member
  ON public.organizations FOR SELECT TO authenticated
  USING (id IN (SELECT hh_org_ids_for_user(auth.uid())));

CREATE POLICY organizations_insert_authenticated
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY organizations_update_manager
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), id));

-- organization_members
CREATE POLICY organization_members_select_visible
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT hh_org_ids_for_user(auth.uid()))
  );

CREATE POLICY organization_members_insert_manager
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

-- First member (owner) when the org has no members yet
CREATE POLICY organization_members_bootstrap_owner
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND NOT EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
    )
  );

CREATE POLICY organization_members_update_manager
  ON public.organization_members FOR UPDATE TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

-- locations
CREATE POLICY locations_select_member
  ON public.locations FOR SELECT TO authenticated
  USING (organization_id IN (SELECT hh_org_ids_for_user(auth.uid())));

CREATE POLICY locations_write_manager
  ON public.locations FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

-- staff_roles
CREATE POLICY staff_roles_select_member
  ON public.staff_roles FOR SELECT TO authenticated
  USING (organization_id IN (SELECT hh_org_ids_for_user(auth.uid())));

CREATE POLICY staff_roles_write_manager
  ON public.staff_roles FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

-- employees
CREATE POLICY employees_select_member
  ON public.employees FOR SELECT TO authenticated
  USING (organization_id IN (SELECT hh_org_ids_for_user(auth.uid())));

CREATE POLICY employees_write_manager
  ON public.employees FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

-- employee_role_assignments
CREATE POLICY employee_role_assignments_select_member
  ON public.employee_role_assignments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT hh_org_ids_for_user(auth.uid())));

CREATE POLICY employee_role_assignments_write_manager
  ON public.employee_role_assignments FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

-- checklists
CREATE POLICY checklists_select_member
  ON public.checklists FOR SELECT TO authenticated
  USING (organization_id IN (SELECT hh_org_ids_for_user(auth.uid())));

CREATE POLICY checklists_write_manager
  ON public.checklists FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

-- checklist_items (via parent checklist org)
CREATE POLICY checklist_items_select_member
  ON public.checklist_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.checklists c
      WHERE c.id = checklist_items.checklist_id
        AND c.organization_id IN (SELECT hh_org_ids_for_user(auth.uid()))
    )
  );

CREATE POLICY checklist_items_write_manager
  ON public.checklist_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.checklists c
      WHERE c.id = checklist_items.checklist_id
        AND public.hh_user_can_manage_org(auth.uid(), c.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.checklists c
      WHERE c.id = checklist_items.checklist_id
        AND public.hh_user_can_manage_org(auth.uid(), c.organization_id)
    )
  );

-- employee_shifts
CREATE POLICY employee_shifts_select_member
  ON public.employee_shifts FOR SELECT TO authenticated
  USING (organization_id IN (SELECT hh_org_ids_for_user(auth.uid())));

CREATE POLICY employee_shifts_write_manager
  ON public.employee_shifts FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

-- shift_checklist_runs
CREATE POLICY shift_checklist_runs_select_member
  ON public.shift_checklist_runs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT hh_org_ids_for_user(auth.uid())));

CREATE POLICY shift_checklist_runs_write_manager
  ON public.shift_checklist_runs FOR ALL TO authenticated
  USING (public.hh_user_can_manage_org(auth.uid(), organization_id))
  WITH CHECK (public.hh_user_can_manage_org(auth.uid(), organization_id));

-- shift_checklist_run_items
CREATE POLICY shift_checklist_run_items_select_member
  ON public.shift_checklist_run_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shift_checklist_runs r
      WHERE r.id = shift_checklist_run_items.shift_checklist_run_id
        AND r.organization_id IN (SELECT hh_org_ids_for_user(auth.uid()))
    )
  );

CREATE POLICY shift_checklist_run_items_write_manager
  ON public.shift_checklist_run_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shift_checklist_runs r
      WHERE r.id = shift_checklist_run_items.shift_checklist_run_id
        AND public.hh_user_can_manage_org(auth.uid(), r.organization_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shift_checklist_runs r
      WHERE r.id = shift_checklist_run_items.shift_checklist_run_id
        AND public.hh_user_can_manage_org(auth.uid(), r.organization_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Grants: no direct anon access (public flows use service role in app)
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.organizations FROM anon;
REVOKE ALL ON public.organization_members FROM anon;
REVOKE ALL ON public.locations FROM anon;
REVOKE ALL ON public.staff_roles FROM anon;
REVOKE ALL ON public.employees FROM anon;
REVOKE ALL ON public.employee_role_assignments FROM anon;
REVOKE ALL ON public.checklists FROM anon;
REVOKE ALL ON public.checklist_items FROM anon;
REVOKE ALL ON public.employee_shifts FROM anon;
REVOKE ALL ON public.shift_checklist_runs FROM anon;
REVOKE ALL ON public.shift_checklist_run_items FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_role_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_checklist_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_checklist_run_items TO authenticated;
