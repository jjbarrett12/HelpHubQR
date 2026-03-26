# HelpHubQR — onboarding & provisioning

This document describes the tenant-safe onboarding system: one **provisioning engine** for self-serve and platform-admin-assisted flows, with **idempotent** writes and an **append-only audit trail**.

## Architecture (Part 1)

### File structure

```
apps/web/
  lib/helphub/onboarding/    # canonical provisioning engine
    types.ts
    provision-organization.ts
    provision-organization-steps.ts
    audit.ts
    idempotency.ts
    onboarding-state.ts
    activation-sync.ts
    starter-pack-engine.ts
    index.ts
  lib/onboarding/
    index.ts                 # barrel
    types.ts                 # shared types
    step-keys.ts             # activation milestone keys
    wizard-steps.ts          # UX wizard order + helpers
    starter-packs/           # industry pack definitions (used by engine)
    provisioning-service.ts  # re-exports engine + legacy helpers
  app/onboarding/provision/
    actions.ts               # selfServeProvisionWorkspace (auth + service role)
  app/app/onboarding/
    layout.tsx
    page.tsx                 # redirects to current wizard slug
    [step]/page.tsx
    actions.ts               # self-serve server actions (auth + service role)
  app/platform-admin/onboarding/
    page.tsx                 # org list + launch summary
    new/page.tsx             # assisted org bootstrap form
    [organizationId]/page.tsx
    actions.ts               # platform admin + service role
  components/onboarding/
    OnboardingProgress.tsx
    OnboardingStepForms.tsx
  components/platform-admin/
    CreateAssistedOrgForm.tsx
    OnboardingOrgDetailPanel.tsx
supabase/migrations/
  20260401110000_organization_onboarding.sql
```

### Service architecture

- **`lib/helphub/onboarding/provision-organization.ts`** — `provisionOrganization()` orchestrates tenant-safe setup (idempotent, auditable). Same function for self-serve and admin-assisted flows.
- **`lib/onboarding/provisioning-service.ts`** — thin re-exports + `createOrganizationWithOwner` (deprecated minimal path).
- **Self-serve (new org)** — `app/onboarding/provision/actions.ts` → `selfServeProvisionWorkspace` (session user must match `owner.authUserId`).
- **Self-serve (wizard)** — `app/app/onboarding/actions.ts` still uses service role for step updates on existing orgs.
- **Platform admin** — `app/platform-admin/onboarding/actions.ts` → `requirePlatformAdmin()` + `provisionOrganization()` for new orgs.

### DB: provisioning idempotency column

- Migration `20260402100000_organization_provisioning_idempotency.sql` adds `organizations.provisioning_idempotency_key` (unique when set) for **partial-failure recovery** without scraping audit payloads. Legacy `bootstrap_organization` events remain supported.

### Idempotency strategy

- Per-org operations: unique partial index on `(organization_id, idempotency_key)` where `status IN ('succeeded','skipped')`.
- Bootstrap (pre-org): unique partial index on `idempotency_key` where `organization_id IS NULL` and status succeeded/skipped.
- Retries: failed rows use a new key suffix (`:failed:<uuid>`) so the timeline stays readable.

### Failure / retry

- Failed attempts record `organization_provisioning_events` with `status = failed` and `error_message`.
- Safe retry: re-invoke the same function; successful paths no-op when the success idempotency row exists.
- **Forced** starter pack re-run: platform UI uses `adminApplyStarterPack(orgId, true)` to supply a **new** idempotency key (`retry:<timestamp>`).

### Audit / events

- All meaningful provisioning outcomes should emit `organization_provisioning_events` (success or failure).
- Org members can **SELECT** their org’s events (RLS); bootstrap rows (`organization_id` null) are visible only via **service role** (e.g. platform admin SQL or future admin view).

## Database (Part 2)

Migration: `supabase/migrations/20260401110000_organization_onboarding.sql`

- `organization_onboarding` — one row per org (`UNIQUE(organization_id)`).
- `organization_onboarding_steps` — `UNIQUE(organization_id, step_key)`.
- `organization_provisioning_events` — append-only; nullable `organization_id` only when `event_type = 'bootstrap_organization'`.

## Self-serve UX (Part 3)

- Routes: `/app/onboarding` → `/app/onboarding/[workspace|location|team|operating|templates|invite|activation]`.
- Progress: chips in `OnboardingProgress`; `organization_onboarding.current_step` is the source of truth.
- Skipping: location and starter pack steps offer skip; state persists in DB.
- Activation: links to Today, Checklists, QR hub, Schedule; “Mark setup complete” calls `markOnboardingCompleted`.

## Admin UX (Part 4)

- `/platform-admin/onboarding` — list all orgs with launch state / industry / plan.
- `/platform-admin/onboarding/new` — assisted create (name + owner `auth.users` id + optional idempotency key).
- `/platform-admin/onboarding/[organizationId]` — activation steps, provisioning timeline, explicit actions (no silent DB edits).

## Starter packs (Part 5)

- Code-defined in `lib/onboarding/starter-packs/packs.ts`, keyed by industry (`janitorial`, `facilities`, `restaurant`, `hospitality`, `events`, `general`).
- **Version** is in the pack object; idempotency keys include `v${version}` so bumping the version intentionally allows a new seed wave (with admin “new key” retry as an operational escape hatch).

## Tenant safety & scale (Part 6)

| Risk | Mitigation |
|------|------------|
| Cross-tenant leakage | All writes scoped by `organization_id`; starter pack code never shares row data across orgs. |
| Duplicate seed data | Idempotency keys + name checks before insert (checklists). |
| Unsafe admin tools | Actions gated by `is_platform_admin`; mutations logged to provisioning events. |
| Orphan org if member insert fails after org insert | Rare; needs transactional RPC or compensating job (see Future hardening). |
| Service role misuse | Only call after explicit auth checks in server actions / route handlers. |

### RLS vs service role (explicit)

- **RLS**: `organization_onboarding*`, `organization_provisioning_events` — **SELECT** for org members; **no INSERT/UPDATE** for `authenticated` in MVP (all writes via service role after auth).
- **Service role**: provisioning engine, platform admin console, any future background worker.

### TODO — Supabase / RLS integration

- [ ] Optional: `SECURITY DEFINER` RPCs that wrap subsets of provisioning if you want to avoid service role from the app server.
- [ ] Grant explicit `INSERT` policies for `authenticated` **only** if you move some writes to user JWT without service role (not recommended for starter pack application).
- [ ] Backfill `organization_onboarding` for existing production orgs (one-off script or migration with `INSERT…SELECT`).
- [ ] Align legacy **`tenants` / `profiles.tenant_id`** with `organizations` if product still uses both (out of scope for this migration).

## Activation tracking (Part 7)

- **Canonical**: `organization_onboarding_steps` (milestones + `metadata` for pack hints).
- **Derived**: `syncDerivedActivationSteps` upgrades steps from counts (locations, roles, checklists, members, employees, QR destinations, shifts, completed runs).
- **Product completion**: `organization_onboarding.completed_at` + `launch_state = launched` + `launch_complete` step.

Use **both**: steps for UX and support; sync to keep them honest as customers use the product.

## Assumptions

- Primary tenant boundary for shift operations is **`organizations` / `organization_members`** (not `tenants`).
- `SUPABASE_SERVICE_ROLE_KEY` is set wherever onboarding server actions run.
- Platform admins are identified by `user_profiles.is_platform_admin` (see `docs/TENANT_MEMBERSHIPS_MIGRATION.md`; legacy `profiles` kept in sync for compatibility).

## Future hardening

- Transactional **org + owner member** creation (Postgres function) to avoid orphan orgs.
- Invite tracking table to drive `managers_invited` / `employees_invited` instead of inferring from counts.
- Starter packs as DB JSON with semver, or storage bucket artifacts + hash verification.
- Background job to run `syncDerivedActivationSteps` on a schedule.
- Link `organization_onboarding.assigned_csm_user_id` to internal staff directory when available.
