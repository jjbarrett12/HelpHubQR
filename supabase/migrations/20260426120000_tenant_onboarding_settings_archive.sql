-- Tenant onboarding + settings, site settings override for archived-room QR, soft-archive for sites/rooms.
-- Preserves ticket history; guest QR resolve rejects archived site; archived room unless site_settings allows.

-- ---------------------------------------------------------------------------
-- 1) tenant_onboarding
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_onboarding (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  primary_admin_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  sites_created_count integer NOT NULL DEFAULT 0,
  rooms_created_count integer NOT NULL DEFAULT 0,
  first_ticket_created_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants (id) ON DELETE CASCADE,
  default_timezone text,
  branding_logo_url text,
  support_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Optional per-site flags (e.g. allow guest QR when room is archived — off by default)
CREATE TABLE IF NOT EXISTS public.site_settings (
  site_id uuid PRIMARY KEY REFERENCES public.sites (id) ON DELETE CASCADE,
  allow_guest_qr_for_archived_rooms boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2) Archive columns
-- ---------------------------------------------------------------------------
DO $arch$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sites'
  ) THEN
    ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS archived_at timestamptz;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'rooms'
  ) THEN
    ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS archived_at timestamptz;
  END IF;
END
$arch$;

CREATE INDEX IF NOT EXISTS sites_tenant_active_idx
  ON public.sites (tenant_id)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS rooms_site_active_idx
  ON public.rooms (site_id)
  WHERE archived_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3) updated_at triggers (reuse generic trigger function)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS tenant_onboarding_set_updated_at ON public.tenant_onboarding;
CREATE TRIGGER tenant_onboarding_set_updated_at
  BEFORE UPDATE ON public.tenant_onboarding
  FOR EACH ROW EXECUTE PROCEDURE public.hh_user_profiles_set_updated_at();

DROP TRIGGER IF EXISTS tenant_settings_set_updated_at ON public.tenant_settings;
CREATE TRIGGER tenant_settings_set_updated_at
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE PROCEDURE public.hh_user_profiles_set_updated_at();

DROP TRIGGER IF EXISTS site_settings_set_updated_at ON public.site_settings;
CREATE TRIGGER site_settings_set_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE PROCEDURE public.hh_user_profiles_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) New tenant → onboarding + settings rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_tenant_bootstrap_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.tenant_onboarding (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  INSERT INTO public.tenant_settings (tenant_id, branding_logo_url)
  VALUES (NEW.id, NEW.logo_url)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_tenant_bootstrap_settings() FROM PUBLIC;

DROP TRIGGER IF EXISTS tenants_bootstrap_onboarding ON public.tenants;
CREATE TRIGGER tenants_bootstrap_onboarding
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE PROCEDURE public.hh_tenant_bootstrap_settings();

-- ---------------------------------------------------------------------------
-- 5) New site → site_settings row + onboarding site count
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_site_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.site_settings (site_id)
  VALUES (NEW.id)
  ON CONFLICT (site_id) DO NOTHING;

  UPDATE public.tenant_onboarding o
  SET
    sites_created_count = o.sites_created_count + 1,
    updated_at = now(),
    status = CASE WHEN o.status = 'not_started' THEN 'in_progress' ELSE o.status END
  WHERE o.tenant_id = NEW.tenant_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_site_after_insert() FROM PUBLIC;

DROP TRIGGER IF EXISTS sites_after_insert_bootstrap ON public.sites;
CREATE TRIGGER sites_after_insert_bootstrap
  AFTER INSERT ON public.sites
  FOR EACH ROW EXECUTE PROCEDURE public.hh_site_after_insert();

-- ---------------------------------------------------------------------------
-- 6) New room → onboarding room count
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_room_after_insert_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tid uuid;
BEGIN
  SELECT s.tenant_id INTO v_tid FROM public.sites s WHERE s.id = NEW.site_id;
  IF v_tid IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.tenant_onboarding o
  SET
    rooms_created_count = o.rooms_created_count + 1,
    updated_at = now(),
    status = CASE WHEN o.status = 'not_started' THEN 'in_progress' ELSE o.status END
  WHERE o.tenant_id = v_tid;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_room_after_insert_onboarding() FROM PUBLIC;

DROP TRIGGER IF EXISTS rooms_after_insert_onboarding ON public.rooms;
CREATE TRIGGER rooms_after_insert_onboarding
  AFTER INSERT ON public.rooms
  FOR EACH ROW EXECUTE PROCEDURE public.hh_room_after_insert_onboarding();

-- ---------------------------------------------------------------------------
-- 7) First ticket timestamp
-- ---------------------------------------------------------------------------
DO $tic$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tickets'
  ) THEN
    RAISE NOTICE 'Skipping ticket onboarding trigger: tickets missing.';
  ELSE
    CREATE OR REPLACE FUNCTION public.hh_ticket_after_insert_onboarding()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    BEGIN
      IF NEW.tenant_id IS NULL THEN
        RETURN NEW;
      END IF;
      UPDATE public.tenant_onboarding o
      SET
        first_ticket_created_at = CASE
          WHEN o.first_ticket_created_at IS NULL THEN NEW.created_at
          WHEN NEW.created_at < o.first_ticket_created_at THEN NEW.created_at
          ELSE o.first_ticket_created_at
        END,
        updated_at = now()
      WHERE o.tenant_id = NEW.tenant_id;
      RETURN NEW;
    END;
    $fn$;

    REVOKE ALL ON FUNCTION public.hh_ticket_after_insert_onboarding() FROM PUBLIC;

    DROP TRIGGER IF EXISTS tickets_after_insert_onboarding ON public.tickets;
    CREATE TRIGGER tickets_after_insert_onboarding
      AFTER INSERT ON public.tickets
      FOR EACH ROW EXECUTE PROCEDURE public.hh_ticket_after_insert_onboarding();
  END IF;
END
$tic$;

-- ---------------------------------------------------------------------------
-- 8) Keep tenant_settings.branding_logo_url in sync when tenants.logo_url changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_tenants_sync_settings_logo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.logo_url IS DISTINCT FROM OLD.logo_url THEN
    UPDATE public.tenant_settings
    SET branding_logo_url = NEW.logo_url, updated_at = now()
    WHERE tenant_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hh_tenants_sync_settings_logo() FROM PUBLIC;

DROP TRIGGER IF EXISTS tenants_sync_tenant_settings_logo ON public.tenants;
CREATE TRIGGER tenants_sync_tenant_settings_logo
  AFTER UPDATE OF logo_url ON public.tenants
  FOR EACH ROW
  WHEN (OLD.logo_url IS DISTINCT FROM NEW.logo_url)
  EXECUTE PROCEDURE public.hh_tenants_sync_settings_logo();

-- ---------------------------------------------------------------------------
-- 9) Backfill existing tenants
-- ---------------------------------------------------------------------------
INSERT INTO public.tenant_onboarding (
  tenant_id,
  sites_created_count,
  rooms_created_count,
  first_ticket_created_at,
  status
)
SELECT
  t.id,
  COALESCE((SELECT COUNT(*)::integer FROM public.sites s WHERE s.tenant_id = t.id), 0),
  COALESCE(
    (SELECT COUNT(*)::integer FROM public.rooms r INNER JOIN public.sites s ON s.id = r.site_id WHERE s.tenant_id = t.id),
    0
  ),
  (SELECT MIN(tk.created_at) FROM public.tickets tk WHERE tk.tenant_id = t.id),
  CASE
    WHEN EXISTS (SELECT 1 FROM public.sites s WHERE s.tenant_id = t.id)
      OR EXISTS (
        SELECT 1 FROM public.rooms r
        INNER JOIN public.sites s ON s.id = r.site_id
        WHERE s.tenant_id = t.id
      )
    THEN 'in_progress'
    ELSE 'not_started'
  END
FROM public.tenants t
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO public.tenant_settings (tenant_id, branding_logo_url, default_timezone, support_email)
SELECT
  t.id,
  t.logo_url,
  NULL,
  t.billing_email
FROM public.tenants t
ON CONFLICT (tenant_id) DO NOTHING;

INSERT INTO public.site_settings (site_id)
SELECT s.id FROM public.sites s
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings x WHERE x.site_id = s.id)
ON CONFLICT (site_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10) Guest token resolve: block archived site; block archived room unless allowed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hh_room_token_resolve_guest(p_raw_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  r public.room_tokens%ROWTYPE;
  v_room public.rooms%ROWTYPE;
  v_site public.sites%ROWTYPE;
  v_allow_archived_room boolean;
BEGIN
  IF p_raw_token IS NULL OR length(trim(p_raw_token)) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid');
  END IF;

  v_hash := encode(digest(trim(p_raw_token), 'sha256'), 'hex');

  SELECT * INTO r FROM public.room_tokens WHERE token_hash = v_hash FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF r.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'revoked');
  END IF;

  IF r.expires_at IS NOT NULL AND r.expires_at <= now() THEN
    UPDATE public.room_tokens
    SET
      revoked_at = now(),
      revoked_reason = coalesce(revoked_reason, 'expired')
    WHERE id = r.id;
    RETURN jsonb_build_object('ok', false, 'code', 'expired');
  END IF;

  UPDATE public.room_tokens SET last_scanned_at = now() WHERE id = r.id;

  SELECT * INTO v_room FROM public.rooms WHERE id = r.room_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'room_missing');
  END IF;

  SELECT * INTO v_site FROM public.sites WHERE id = v_room.site_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'site_missing');
  END IF;

  IF v_site.archived_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'archived');
  END IF;

  IF v_room.archived_at IS NOT NULL THEN
    SELECT COALESCE(ss.allow_guest_qr_for_archived_rooms, false)
    INTO v_allow_archived_room
    FROM public.site_settings ss
    WHERE ss.site_id = v_room.site_id;

    IF NOT COALESCE(v_allow_archived_room, false) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'archived');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'site_name', v_site.name,
    'room_label', v_room.room_label,
    'room_id', v_room.id,
    'site_id', v_site.id,
    'tenant_id', v_site.tenant_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hh_room_token_resolve_guest(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hh_room_token_resolve_guest(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 11) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenant_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tenant_onboarding FROM anon;
REVOKE ALL ON public.tenant_settings FROM anon;
REVOKE ALL ON public.site_settings FROM anon;

GRANT SELECT ON public.tenant_onboarding TO authenticated;
GRANT SELECT, UPDATE ON public.tenant_onboarding TO authenticated;
GRANT SELECT ON public.tenant_settings TO authenticated;
GRANT SELECT, UPDATE ON public.tenant_settings TO authenticated;
GRANT SELECT ON public.site_settings TO authenticated;
GRANT SELECT, UPDATE, INSERT ON public.site_settings TO authenticated;

DROP POLICY IF EXISTS tenant_onboarding_select_member ON public.tenant_onboarding;
CREATE POLICY tenant_onboarding_select_member
  ON public.tenant_onboarding FOR SELECT TO authenticated
  USING (
    public.hh_tenant_has_active_role(auth.uid(), tenant_id, ARRAY['admin', 'manager', 'staff']::text[])
    OR public.hh_user_is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS tenant_onboarding_update_admin ON public.tenant_onboarding;
CREATE POLICY tenant_onboarding_update_admin
  ON public.tenant_onboarding FOR UPDATE TO authenticated
  USING (
    public.hh_tenant_user_is_admin(auth.uid(), tenant_id)
    OR public.hh_user_is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.hh_tenant_user_is_admin(auth.uid(), tenant_id)
    OR public.hh_user_is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS tenant_settings_select_member ON public.tenant_settings;
CREATE POLICY tenant_settings_select_member
  ON public.tenant_settings FOR SELECT TO authenticated
  USING (
    public.hh_tenant_has_active_role(auth.uid(), tenant_id, ARRAY['admin', 'manager', 'staff']::text[])
    OR public.hh_user_is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS tenant_settings_update_admin ON public.tenant_settings;
CREATE POLICY tenant_settings_update_admin
  ON public.tenant_settings FOR UPDATE TO authenticated
  USING (
    public.hh_tenant_user_is_admin(auth.uid(), tenant_id)
    OR public.hh_user_is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.hh_tenant_user_is_admin(auth.uid(), tenant_id)
    OR public.hh_user_is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS site_settings_select_member ON public.site_settings;
CREATE POLICY site_settings_select_member
  ON public.site_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_settings.site_id
        AND public.hh_tenant_has_active_role(auth.uid(), s.tenant_id, ARRAY['admin', 'manager', 'staff']::text[])
    )
    OR public.hh_user_is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS site_settings_insert_admin ON public.site_settings;
CREATE POLICY site_settings_insert_admin
  ON public.site_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_settings.site_id
        AND (
          public.hh_tenant_user_is_admin(auth.uid(), s.tenant_id)
          OR public.hh_user_is_platform_admin(auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS site_settings_update_admin ON public.site_settings;
CREATE POLICY site_settings_update_admin
  ON public.site_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_settings.site_id
        AND (
          public.hh_tenant_user_is_admin(auth.uid(), s.tenant_id)
          OR public.hh_user_is_platform_admin(auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_settings.site_id
        AND (
          public.hh_tenant_user_is_admin(auth.uid(), s.tenant_id)
          OR public.hh_user_is_platform_admin(auth.uid())
        )
    )
  );
