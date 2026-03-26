-- Organization onboarding, per-step progress, and append-only provisioning audit.
-- Writes from the app should go through server-side provisioning (service role) after auth checks;
-- org members may read their own onboarding state for UX. Platform admin uses service role (bypasses RLS).

-- ---------------------------------------------------------------------------
-- 1) organization_onboarding — one row per organization (wizard + launch metadata)
-- ---------------------------------------------------------------------------
CREATE TABLE public.organization_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations (id) ON DELETE CASCADE,
  onboarding_mode text NOT NULL CHECK (onboarding_mode IN ('self_serve', 'admin_assisted', 'imported')),
  industry text,
  plan_key text,
  current_step text,
  launch_state text NOT NULL DEFAULT 'created' CHECK (
    launch_state IN ('created', 'in_progress', 'blocked', 'launched', 'churned')
  ),
  assigned_csm_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX organization_onboarding_launch_state_idx
  ON public.organization_onboarding (launch_state, updated_at DESC);
CREATE INDEX organization_onboarding_industry_idx
  ON public.organization_onboarding (industry)
  WHERE industry IS NOT NULL;

CREATE TRIGGER organization_onboarding_set_updated_at
  BEFORE UPDATE ON public.organization_onboarding
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

COMMENT ON TABLE public.organization_onboarding IS
  'Single onboarding record per org: wizard position (current_step), commercial fields, launch lifecycle.';
COMMENT ON COLUMN public.organization_onboarding.current_step IS
  'Product wizard slug (e.g. workspace, location, templates). Distinct from organization_onboarding_steps.step_key milestones.';
COMMENT ON COLUMN public.organization_onboarding.launch_state IS
  'Operational launch phase; blocked = needs human intervention.';

-- ---------------------------------------------------------------------------
-- 2) organization_onboarding_steps — idempotent milestone rows per org
-- ---------------------------------------------------------------------------
CREATE TABLE public.organization_onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  step_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_progress', 'completed', 'skipped', 'failed')
  ),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, step_key)
);

CREATE INDEX organization_onboarding_steps_org_status_idx
  ON public.organization_onboarding_steps (organization_id, status);

CREATE TRIGGER organization_onboarding_steps_set_updated_at
  BEFORE UPDATE ON public.organization_onboarding_steps
  FOR EACH ROW EXECUTE PROCEDURE public.hh_set_updated_at();

COMMENT ON TABLE public.organization_onboarding_steps IS
  'Activation and setup milestones; sync from provisioning + derived checks in application layer.';

-- ---------------------------------------------------------------------------
-- 3) organization_provisioning_events — append-only audit + idempotency anchor
-- ---------------------------------------------------------------------------
CREATE TABLE public.organization_provisioning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'skipped')),
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_provisioning_events_org_bootstrap_chk CHECK (
    organization_id IS NOT NULL OR event_type = 'bootstrap_organization'
  )
);

CREATE INDEX organization_provisioning_events_org_created_idx
  ON public.organization_provisioning_events (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;
CREATE INDEX organization_provisioning_events_org_type_idx
  ON public.organization_provisioning_events (organization_id, event_type)
  WHERE organization_id IS NOT NULL;

CREATE UNIQUE INDEX organization_provisioning_events_idempotency_success_uidx
  ON public.organization_provisioning_events (organization_id, idempotency_key)
  WHERE status IN ('succeeded', 'skipped') AND organization_id IS NOT NULL;

CREATE UNIQUE INDEX organization_provisioning_events_bootstrap_idempotency_uidx
  ON public.organization_provisioning_events (idempotency_key)
  WHERE status IN ('succeeded', 'skipped') AND organization_id IS NULL;

COMMENT ON TABLE public.organization_provisioning_events IS
  'Immutable audit log. organization_id NULL only for bootstrap_organization rows (pre-org idempotency).';
COMMENT ON COLUMN public.organization_provisioning_events.idempotency_key IS
  'Stable key per logical operation; unique per org for succeeded/skipped, or globally for bootstrap rows.';

-- ---------------------------------------------------------------------------
-- RLS — read for org members; writes via service role from trusted server code
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_provisioning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_onboarding_select_member
  ON public.organization_onboarding FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.hh_org_ids_for_user(auth.uid())));

CREATE POLICY organization_onboarding_steps_select_member
  ON public.organization_onboarding_steps FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.hh_org_ids_for_user(auth.uid())));

CREATE POLICY organization_provisioning_events_select_member
  ON public.organization_provisioning_events FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND organization_id IN (SELECT public.hh_org_ids_for_user(auth.uid()))
  );

REVOKE ALL ON public.organization_onboarding FROM anon;
REVOKE ALL ON public.organization_onboarding_steps FROM anon;
REVOKE ALL ON public.organization_provisioning_events FROM anon;

GRANT SELECT ON public.organization_onboarding TO authenticated;
GRANT SELECT ON public.organization_onboarding_steps TO authenticated;
GRANT SELECT ON public.organization_provisioning_events TO authenticated;
