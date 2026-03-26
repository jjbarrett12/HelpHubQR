-- Provisioning recovery + onboarding metadata (no RLS change; service role writes).
-- Enables deterministic org lookup by idempotency key without scraping audit payloads.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS provisioning_idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_provisioning_idempotency_key_uidx
  ON public.organizations (provisioning_idempotency_key)
  WHERE provisioning_idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.organizations.provisioning_idempotency_key IS
  'Set once at org creation by provisioning engine; used for safe retry / partial recovery.';

ALTER TABLE public.organization_onboarding
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS employee_count_range text,
  ADD COLUMN IF NOT EXISTS location_count_estimate text;

COMMENT ON COLUMN public.organization_onboarding.timezone IS
  'IANA or display timezone captured at signup; optional.';
