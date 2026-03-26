-- Run after 20260425100000_tenant_memberships_user_profiles_invites.sql

-- 1) Every legacy profile user has user_profiles
SELECT p.user_id
FROM public.profiles p
LEFT JOIN public.user_profiles up ON up.user_id = p.user_id
WHERE up.user_id IS NULL;

-- 2) Every legacy profile has at least one membership (except platform-only edge cases)
SELECT p.user_id, p.tenant_id
FROM public.profiles p
LEFT JOIN public.tenant_memberships m
  ON m.user_id = p.user_id AND m.tenant_id = p.tenant_id AND m.status = 'active'
WHERE p.tenant_id IS NOT NULL AND m.id IS NULL;

-- 3) Orphan memberships (no tenant)
SELECT m.id FROM public.tenant_memberships m
LEFT JOIN public.tenants t ON t.id = m.tenant_id
WHERE t.id IS NULL;

-- 4) Pending invites about to expire (informational)
SELECT id, tenant_id, email, expires_at
FROM public.tenant_invites
WHERE status = 'pending' AND expires_at < now() + interval '1 day';
