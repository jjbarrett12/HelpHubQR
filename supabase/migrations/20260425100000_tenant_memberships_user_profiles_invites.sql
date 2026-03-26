-- Tenant identity model: global user_profiles, per-tenant memberships + invites.
-- Backfills from legacy public.profiles; keeps public.profiles in sync via trigger (compat).
-- Idempotent: safe to re-run in CI; uses IF NOT EXISTS / OR REPLACE where appropriate.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- 0) Ensure tenants + profiles exist (production may already have them; greenfield may not)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  branding jsonb,
  billing_email text,
  billing_name text,
  billing_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
  is_platform_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Optional columns some deployments may add later
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS branding jsonb;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_email text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS billing_address text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

-- Platform admins may have no tenant membership; allow NULL tenant_id on legacy profiles row.
ALTER TABLE public.profiles ALTER COLUMN tenant_id DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 1) user_profiles (global)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  is_platform_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);

CREATE OR REPLACE FUNCTION public.hh_user_profiles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_set_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.hh_user_profiles_set_updated_at();

CREATE INDEX IF NOT EXISTS user_profiles_email_lower_idx ON public.user_profiles (lower(trim(email)));

CREATE OR REPLACE FUNCTION public.hh_auth_user_create_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    lower(trim(COALESCE(NEW.email, ''))),
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')), ''),
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = COALESCE(NULLIF(EXCLUDED.email, ''), public.user_profiles.email),
    full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name),
    updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_auth_user_create_user_profile() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created_user_profiles ON auth.users;
CREATE TRIGGER on_auth_user_created_user_profiles
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.hh_auth_user_create_user_profile();

-- ---------------------------------------------------------------------------
-- 2) tenant_memberships
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
  status text NOT NULL CHECK (status IN ('active', 'invited', 'disabled'))
    DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  disabled_at timestamptz,
  UNIQUE (tenant_id, user_id)
);

CREATE OR REPLACE FUNCTION public.hh_tenant_memberships_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_memberships_set_updated_at ON public.tenant_memberships;
CREATE TRIGGER tenant_memberships_set_updated_at
  BEFORE UPDATE ON public.tenant_memberships
  FOR EACH ROW EXECUTE PROCEDURE public.hh_tenant_memberships_set_updated_at();

CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_id_idx ON public.tenant_memberships (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_user_id_idx ON public.tenant_memberships (user_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_role_idx ON public.tenant_memberships (tenant_id, role);
CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_status_idx ON public.tenant_memberships (tenant_id, status);

-- ---------------------------------------------------------------------------
-- 3) tenant_invites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
  invite_token_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))
    DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT tenant_invites_token_hash_unique UNIQUE (invite_token_hash)
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_invites_one_pending_per_email
  ON public.tenant_invites (tenant_id, lower(trim(email)))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS tenant_invites_tenant_id_idx ON public.tenant_invites (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_invites_email_lower_idx ON public.tenant_invites (lower(trim(email)));

-- ---------------------------------------------------------------------------
-- 4) Backfill from profiles (once)
-- ---------------------------------------------------------------------------
INSERT INTO public.user_profiles (user_id, full_name, email, phone, is_platform_admin, created_at, updated_at)
SELECT
  p.user_id,
  NULLIF(trim(COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '')), ''),
  lower(trim(au.email)),
  NULL,
  COALESCE(p.is_platform_admin, false),
  COALESCE(p.created_at, now()),
  now()
FROM public.profiles p
JOIN auth.users au ON au.id = p.user_id
ON CONFLICT (user_id) DO UPDATE SET
  is_platform_admin = EXCLUDED.is_platform_admin OR public.user_profiles.is_platform_admin,
  email = COALESCE(EXCLUDED.email, public.user_profiles.email),
  full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name),
  updated_at = now();

INSERT INTO public.tenant_memberships (
  tenant_id, user_id, role, status, created_at, updated_at, created_by, disabled_at
)
SELECT
  p.tenant_id,
  p.user_id,
  p.role,
  'active',
  COALESCE(p.created_at, now()),
  now(),
  NULL,
  NULL
FROM public.profiles p
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
  role = EXCLUDED.role,
  status = 'active',
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 5) Legacy profiles sync (primary = earliest active membership by created_at)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_sync_legacy_profile_from_memberships()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_tid uuid;
  v_role text;
  v_admin boolean;
BEGIN
  v_uid := COALESCE(NEW.user_id, OLD.user_id);

  SELECT tm.tenant_id, tm.role
  INTO v_tid, v_role
  FROM public.tenant_memberships tm
  WHERE tm.user_id = v_uid AND tm.status = 'active'
  ORDER BY tm.created_at ASC, tm.id ASC
  LIMIT 1;

  SELECT COALESCE(up.is_platform_admin, false) INTO v_admin
  FROM public.user_profiles up WHERE up.user_id = v_uid;

  IF v_tid IS NULL THEN
    IF COALESCE(v_admin, false) THEN
      UPDATE public.profiles
      SET tenant_id = NULL, role = COALESCE(role, 'staff'), is_platform_admin = true
      WHERE user_id = v_uid;
      IF NOT FOUND THEN
        INSERT INTO public.profiles (user_id, tenant_id, role, is_platform_admin, created_at)
        VALUES (v_uid, NULL, 'staff', true, now());
      END IF;
    ELSE
      DELETE FROM public.profiles WHERE user_id = v_uid;
    END IF;
  ELSE
    INSERT INTO public.profiles (user_id, tenant_id, role, is_platform_admin, created_at)
    VALUES (v_uid, v_tid, v_role, COALESCE(v_admin, false), now())
    ON CONFLICT (user_id) DO UPDATE SET
      tenant_id = EXCLUDED.tenant_id,
      role = EXCLUDED.role,
      is_platform_admin = EXCLUDED.is_platform_admin;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.hh_sync_legacy_profile_from_memberships() FROM PUBLIC;

DROP TRIGGER IF EXISTS tenant_memberships_sync_legacy_profile ON public.tenant_memberships;
CREATE TRIGGER tenant_memberships_sync_legacy_profile
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_memberships
  FOR EACH ROW EXECUTE PROCEDURE public.hh_sync_legacy_profile_from_memberships();

-- Sync user_profiles.is_platform_admin -> profiles when user_profiles changes
CREATE OR REPLACE FUNCTION public.hh_sync_legacy_profile_platform_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET is_platform_admin = NEW.is_platform_admin
  WHERE p.user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_sync_legacy_profile_platform_flag() FROM PUBLIC;

DROP TRIGGER IF EXISTS user_profiles_sync_platform_flag ON public.user_profiles;
CREATE TRIGGER user_profiles_sync_platform_flag
  AFTER UPDATE OF is_platform_admin ON public.user_profiles
  FOR EACH ROW
  WHEN (OLD.is_platform_admin IS DISTINCT FROM NEW.is_platform_admin)
  EXECUTE PROCEDURE public.hh_sync_legacy_profile_platform_flag();

-- ---------------------------------------------------------------------------
-- 6) Helper predicates (STABLE, for RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_user_is_platform_admin(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.user_profiles WHERE user_id = p_uid),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.hh_user_is_platform_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_user_is_platform_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.hh_tenant_has_active_role(p_uid uuid, p_tenant_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships m
    WHERE m.user_id = p_uid
      AND m.tenant_id = p_tenant_id
      AND m.status = 'active'
      AND m.role = ANY (p_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.hh_tenant_has_active_role(uuid, uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_tenant_has_active_role(uuid, uuid, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.hh_tenant_user_is_admin(p_uid uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.hh_tenant_has_active_role(p_uid, p_tenant_id, ARRAY['admin']::text[])
     OR public.hh_user_is_platform_admin(p_uid);
$$;

REVOKE ALL ON FUNCTION public.hh_tenant_user_is_admin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_tenant_user_is_admin(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_profiles FROM anon;
REVOKE ALL ON public.tenant_memberships FROM anon;
REVOKE ALL ON public.tenant_invites FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tenant_invites TO authenticated;

DROP POLICY IF EXISTS user_profiles_select_own ON public.user_profiles;
CREATE POLICY user_profiles_select_own
  ON public.user_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_profiles_update_own_safe ON public.user_profiles;
CREATE POLICY user_profiles_update_own_safe
  ON public.user_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND is_platform_admin = (SELECT up.is_platform_admin FROM public.user_profiles up WHERE up.user_id = auth.uid())
  );

DROP POLICY IF EXISTS user_profiles_insert_own ON public.user_profiles;
CREATE POLICY user_profiles_insert_own
  ON public.user_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_platform_admin = false);

-- Platform admins may read any profile (support); service_role bypasses RLS
DROP POLICY IF EXISTS user_profiles_platform_admin_select ON public.user_profiles;
CREATE POLICY user_profiles_platform_admin_select
  ON public.user_profiles FOR SELECT TO authenticated
  USING (public.hh_user_is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS tenant_memberships_select_same_tenant ON public.tenant_memberships;
CREATE POLICY tenant_memberships_select_same_tenant
  ON public.tenant_memberships FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = tenant_memberships.tenant_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
    OR public.hh_user_is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS tenant_memberships_insert_admin ON public.tenant_memberships;
CREATE POLICY tenant_memberships_insert_admin
  ON public.tenant_memberships FOR INSERT TO authenticated
  WITH CHECK (
    public.hh_tenant_user_is_admin(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS tenant_memberships_update_admin ON public.tenant_memberships;
CREATE POLICY tenant_memberships_update_admin
  ON public.tenant_memberships FOR UPDATE TO authenticated
  USING (
    public.hh_tenant_user_is_admin(auth.uid(), tenant_id)
    OR public.hh_user_is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.hh_tenant_user_is_admin(auth.uid(), tenant_id)
    OR public.hh_user_is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS tenant_memberships_delete_admin ON public.tenant_memberships;
CREATE POLICY tenant_memberships_delete_admin
  ON public.tenant_memberships FOR DELETE TO authenticated
  USING (
    public.hh_tenant_user_is_admin(auth.uid(), tenant_id)
    OR public.hh_user_is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS tenant_invites_select_admin ON public.tenant_invites;
CREATE POLICY tenant_invites_select_admin
  ON public.tenant_invites FOR SELECT TO authenticated
  USING (
    public.hh_tenant_user_is_admin(auth.uid(), tenant_id)
    OR public.hh_user_is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS tenant_invites_insert_admin ON public.tenant_invites;
CREATE POLICY tenant_invites_insert_admin
  ON public.tenant_invites FOR INSERT TO authenticated
  WITH CHECK (public.hh_tenant_user_is_admin(auth.uid(), tenant_id));

DROP POLICY IF EXISTS tenant_invites_update_admin ON public.tenant_invites;
CREATE POLICY tenant_invites_update_admin
  ON public.tenant_invites FOR UPDATE TO authenticated
  USING (public.hh_tenant_user_is_admin(auth.uid(), tenant_id));

-- ---------------------------------------------------------------------------
-- 8) RPCs (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_tenant_create_invite(
  p_tenant_id uuid,
  p_email text,
  p_role text,
  p_ttl_interval interval DEFAULT interval '7 days'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
  v_hash text;
  v_id uuid;
  v_norm text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;
  IF NOT public.hh_tenant_user_is_admin(v_uid, p_tenant_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_role NOT IN ('admin', 'manager', 'staff') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_ROLE');
  END IF;
  v_norm := lower(trim(p_email));
  IF v_norm = '' OR v_norm !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_EMAIL');
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.tenant_invites (
    tenant_id, email, role, invite_token_hash, status, expires_at, created_by
  ) VALUES (
    p_tenant_id, v_norm, p_role, v_hash, 'pending', now() + p_ttl_interval, v_uid
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'invite_id', v_id,
    'token', v_token,
    'expires_at', to_jsonb(now() + p_ttl_interval)
  );
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'PENDING_INVITE_EXISTS');
END;
$$;

REVOKE ALL ON FUNCTION public.hh_tenant_create_invite(uuid, text, text, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_tenant_create_invite(uuid, text, text, interval) TO authenticated;

CREATE OR REPLACE FUNCTION public.hh_tenant_accept_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
  inv public.tenant_invites%ROWTYPE;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;
  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');

  SELECT * INTO inv
  FROM public.tenant_invites
  WHERE invite_token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVITE_NOT_FOUND');
  END IF;
  IF inv.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVITE_NOT_PENDING');
  END IF;
  IF inv.expires_at < now() THEN
    UPDATE public.tenant_invites SET status = 'expired' WHERE id = inv.id;
    RETURN jsonb_build_object('ok', false, 'error', 'INVITE_EXPIRED');
  END IF;

  SELECT lower(trim(email)) INTO v_email FROM auth.users WHERE id = v_uid;
  IF v_email IS NULL OR v_email <> inv.email THEN
    RETURN jsonb_build_object('ok', false, 'error', 'EMAIL_MISMATCH');
  END IF;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status, created_by)
  VALUES (inv.tenant_id, v_uid, inv.role, 'active', v_uid)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    status = 'active',
    disabled_at = NULL,
    updated_at = now();

  UPDATE public.tenant_invites
  SET status = 'accepted', accepted_at = now()
  WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'tenant_id', inv.tenant_id, 'role', inv.role);
END;
$$;

REVOKE ALL ON FUNCTION public.hh_tenant_accept_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_tenant_accept_invite(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.hh_tenant_disable_member(p_tenant_id uuid, p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;
  IF NOT public.hh_tenant_user_is_admin(v_uid, p_tenant_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;
  IF p_target_user_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'CANNOT_DISABLE_SELF');
  END IF;

  UPDATE public.tenant_memberships
  SET status = 'disabled', disabled_at = now(), updated_at = now()
  WHERE tenant_id = p_tenant_id AND user_id = p_target_user_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MEMBERSHIP_NOT_FOUND');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.hh_tenant_disable_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_tenant_disable_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.hh_tenant_list_members(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;
  IF NOT (
    public.hh_tenant_user_is_admin(v_uid, p_tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships m
      WHERE m.tenant_id = p_tenant_id AND m.user_id = v_uid AND m.status = 'active'
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'ok', true,
      'members',
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'user_id', m.user_id,
            'role', m.role,
            'status', m.status,
            'created_at', m.created_at,
            'disabled_at', m.disabled_at
          )
          ORDER BY m.created_at
        ),
        '[]'::jsonb
      )
    )
    FROM public.tenant_memberships m
    WHERE m.tenant_id = p_tenant_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hh_tenant_list_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_tenant_list_members(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.hh_tenant_revoke_invite(p_invite_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHENTICATED');
  END IF;
  SELECT tenant_id INTO v_tenant FROM public.tenant_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND');
  END IF;
  IF NOT public.hh_tenant_user_is_admin(v_uid, v_tenant) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'FORBIDDEN');
  END IF;

  UPDATE public.tenant_invites
  SET status = 'revoked', revoked_at = now()
  WHERE id = p_invite_id AND status = 'pending';
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.hh_tenant_revoke_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_tenant_revoke_invite(uuid) TO authenticated;

COMMENT ON TABLE public.user_profiles IS 'Global user attributes; one row per auth user.';
COMMENT ON TABLE public.tenant_memberships IS 'Tenant-scoped membership + role; source of truth for dashboard tenant access.';
COMMENT ON TABLE public.tenant_invites IS 'Pending invites; token stored as SHA-256 hex only; use hh_tenant_create_invite / hh_tenant_accept_invite.';
COMMENT ON FUNCTION public.hh_tenant_create_invite IS 'Tenant admin or platform admin: create invite; returns plaintext token once in JSON.';
COMMENT ON FUNCTION public.hh_tenant_accept_invite IS 'Authenticated user: accept if auth email matches invite email.';
