-- Room QR tokens: store SHA-256 hashes only, allow history, at most one unrevoked row per room.
-- Partial unique uses revoked_at only (not expires_at) because NOW() is not immutable in index predicates.
-- Expiry is enforced in application and in hh_room_token_resolve_guest (lazy revoke).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'room_tokens'
  ) THEN
    RAISE NOTICE 'Skipping room_tokens migration: table public.room_tokens does not exist.';
    RETURN;
  END IF;

  ALTER TABLE public.room_tokens ADD COLUMN IF NOT EXISTS token_hash text;
  ALTER TABLE public.room_tokens ADD COLUMN IF NOT EXISTS expires_at timestamptz;
  ALTER TABLE public.room_tokens ADD COLUMN IF NOT EXISTS revoked_reason text;
  ALTER TABLE public.room_tokens
    ADD COLUMN IF NOT EXISTS rotated_from_token_id uuid REFERENCES public.room_tokens (id);

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'room_tokens' AND column_name = 'token'
  ) THEN
    UPDATE public.room_tokens rt
    SET token_hash = encode(digest(trim(rt.token), 'sha256'), 'hex')
    WHERE rt.token_hash IS NULL AND rt.token IS NOT NULL;
  END IF;

  ALTER TABLE public.room_tokens DROP CONSTRAINT IF EXISTS room_tokens_room_id_key;
  ALTER TABLE public.room_tokens DROP CONSTRAINT IF EXISTS room_tokens_token_key;

  DROP INDEX IF EXISTS room_tokens_token_uidx;
  DROP INDEX IF EXISTS room_tokens_token_hash_uidx;
  CREATE UNIQUE INDEX room_tokens_token_hash_uidx ON public.room_tokens (token_hash);

  DROP INDEX IF EXISTS room_tokens_one_unrevoked_per_room_uidx;
  CREATE UNIQUE INDEX room_tokens_one_unrevoked_per_room_uidx
    ON public.room_tokens (room_id)
    WHERE revoked_at IS NULL;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'room_tokens' AND column_name = 'token'
  ) THEN
    ALTER TABLE public.room_tokens DROP COLUMN token;
  END IF;

  IF EXISTS (SELECT 1 FROM public.room_tokens WHERE token_hash IS NULL) THEN
    RAISE EXCEPTION 'room_tokens migration: token_hash is still null for some rows (legacy token column missing or empty?)';
  END IF;

  ALTER TABLE public.room_tokens ALTER COLUMN token_hash SET NOT NULL;
END
$migration$;

-- Guest resolve + touch (service role / server only)
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

-- Guest flows use the Next.js API + service role; do not expose room token rows to anonymous clients.
DO $anon$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'room_tokens'
  ) THEN
    REVOKE ALL ON TABLE public.room_tokens FROM anon;
  END IF;
END
$anon$;
