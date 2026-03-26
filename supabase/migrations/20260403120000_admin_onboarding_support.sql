-- Internal platform-admin onboarding: support notes, owner invite audit, blocker metadata.
-- Access: application server uses service role only (no authenticated policies).

-- ---------------------------------------------------------------------------
-- organization_support_notes — append-only style (no UPDATE/DELETE policies)
-- ---------------------------------------------------------------------------
CREATE TABLE public.organization_support_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) > 0),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX organization_support_notes_org_created_idx
  ON public.organization_support_notes (organization_id, created_at DESC);

COMMENT ON TABLE public.organization_support_notes IS
  'Platform-admin support notes per org; not visible to tenant RLS.';

-- ---------------------------------------------------------------------------
-- organization_owner_invite_log — audit trail for invite / magic-link generation
-- ---------------------------------------------------------------------------
CREATE TABLE public.organization_owner_invite_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  channel text NOT NULL DEFAULT 'auth_admin' CHECK (channel IN ('auth_admin')),
  action text NOT NULL CHECK (action IN ('invite_email', 'magiclink')),
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'link_ready')),
  provider_message text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX organization_owner_invite_log_org_created_idx
  ON public.organization_owner_invite_log (organization_id, created_at DESC);

COMMENT ON TABLE public.organization_owner_invite_log IS
  'Audit for owner invite attempts; does not store magic links (returned once to operator).';

-- ---------------------------------------------------------------------------
-- organization_onboarding — blocker metadata
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_onboarding
  ADD COLUMN IF NOT EXISTS blocker_reason text,
  ADD COLUMN IF NOT EXISTS blocker_category text,
  ADD COLUMN IF NOT EXISTS blocker_flagged_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blocker_flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocker_cleared_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blocker_cleared_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocker_resolution_note text;

COMMENT ON COLUMN public.organization_onboarding.blocker_category IS
  'Support taxonomy e.g. billing, product, customer_unresponsive, data, other.';

-- ---------------------------------------------------------------------------
-- RLS: deny direct tenant access; service role bypasses
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_support_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_owner_invite_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.organization_support_notes FROM anon;
REVOKE ALL ON public.organization_support_notes FROM authenticated;
REVOKE ALL ON public.organization_owner_invite_log FROM anon;
REVOKE ALL ON public.organization_owner_invite_log FROM authenticated;
