# Tenant memberships migration (`user_profiles`, `tenant_memberships`, `tenant_invites`)

## Migration file

- `supabase/migrations/20260425100000_tenant_memberships_user_profiles_invites.sql`

## What changed

| Area | Detail |
|------|--------|
| **New tables** | `user_profiles` (global), `tenant_memberships` (per-tenant role + lifecycle), `tenant_invites` (hashed token invites). |
| **Backfill** | Rows from `profiles` → `user_profiles` + `tenant_memberships` (`status = active`). |
| **Legacy `profiles`** | **Not dropped.** Kept in sync via trigger on `tenant_memberships` (primary tenant = earliest active membership by `created_at`). `tenant_id` may be **NULL** for platform admins with no tenant. |
| **Platform admin** | Stored on `user_profiles.is_platform_admin`. App reads this instead of `profiles`. |
| **RPCs** | `hh_tenant_create_invite`, `hh_tenant_accept_invite`, `hh_tenant_disable_member`, `hh_tenant_list_members`, `hh_tenant_revoke_invite`. |
| **Auth** | Trigger on `auth.users` upserts `user_profiles` for new signups. |

## Manual steps

1. **Apply migration** (local / hosted Supabase):  
   `supabase db push` or run the SQL in the dashboard SQL editor.
2. **Verify** (optional): run `scripts/verify-tenant-memberships.sql` in SQL editor.
3. **Smoke test**: sign in as tenant user → `/app` layout branding; platform admin → `/platform-admin` and `/admin/*`; tenant admin → `/app/settings`.
4. **Invites**: from platform-admin tenant detail, create invite → copy token → sign in as invitee (same email) → call `hh_tenant_accept_invite` (wire a small UI or use SQL editor for testing).

## Risk / rollback / verification

### Risks

- **Multi-tenant users**: “Default” tenant for dashboard UI is **first active membership by `created_at`**. If that ordering is wrong for your product, add an explicit `is_default` column later.
- **`auth.users` trigger**: Some restricted environments disallow triggers on `auth.users`. If migration fails there, drop the `on_auth_user_created_user_profiles` trigger block and backfill `user_profiles` via Edge Function / app on first login.
- **RLS**: Tenant admins manage memberships; members can read peer rows in same tenant. Misconfigured policies would leak metadata — review policies after deploy.
- **`profiles` sync trigger**: Any direct `profiles` edit by old code could be overwritten on next `tenant_memberships` change.

### Rollback (coarse)

1. Revert app deployment to the previous commit (restores `profiles` reads).
2. DB rollback: drop new tables/policies/functions/triggers **only** if no production data depends on them; otherwise leave schema and revert app only.

### Verification

- `SELECT count(*) FROM tenant_memberships` matches expected active users.
- `SELECT * FROM user_profiles WHERE user_id = '<uid>'` for a test user.
- `profiles` row still exists for legacy paths and matches primary membership (or NULL `tenant_id` for platform-only admins).

## App files touched

See repository commit / final assistant summary for the list of TS/TSX updates. Core helper: `apps/web/lib/tenant-auth/context.ts`.
