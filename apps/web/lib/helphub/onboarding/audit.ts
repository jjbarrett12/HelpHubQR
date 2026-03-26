import type { ServiceSupabase } from "./types";
import { PROVISION_FINAL_EVENT } from "./types";

export type ProvisioningEventInsert = {
  organization_id: string | null;
  event_type: string;
  status: "started" | "succeeded" | "failed" | "skipped";
  idempotency_key: string;
  payload?: Record<string, unknown>;
  error_message?: string | null;
};

/**
 * Returns organization id if a prior successful full provision exists for this key.
 */
export async function findCompletedProvisionOrganizationId(
  admin: ServiceSupabase,
  idempotencyKey: string
): Promise<string | null> {
  const { data } = await admin
    .from("organization_provisioning_events")
    .select("organization_id, payload")
    .eq("idempotency_key", idempotencyKey)
    .eq("event_type", PROVISION_FINAL_EVENT)
    .eq("status", "succeeded")
    .not("organization_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.organization_id) return data.organization_id as string;
  const p = data?.payload as { organization_id?: string } | undefined;
  return p?.organization_id ?? null;
}

/** Primary recovery: org row stamped at create time. */
export async function findOrganizationIdByProvisioningKey(
  admin: ServiceSupabase,
  idempotencyKey: string
): Promise<string | null> {
  const { data } = await admin
    .from("organizations")
    .select("id")
    .eq("provisioning_idempotency_key", idempotencyKey)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Legacy bootstrap events (organization_id IS NULL). */
export async function findBootstrapOrganizationId(
  admin: ServiceSupabase,
  idempotencyKey: string
): Promise<string | null> {
  const { data } = await admin
    .from("organization_provisioning_events")
    .select("payload")
    .is("organization_id", null)
    .eq("event_type", "bootstrap_organization")
    .eq("idempotency_key", idempotencyKey)
    .in("status", ["succeeded", "skipped"])
    .maybeSingle();
  const p = data?.payload as { organization_id?: string } | undefined;
  return p?.organization_id ?? null;
}

export async function insertProvisioningEvent(
  admin: ServiceSupabase,
  row: ProvisioningEventInsert
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin.from("organization_provisioning_events").insert({
    organization_id: row.organization_id,
    event_type: row.event_type,
    status: row.status,
    idempotency_key: row.idempotency_key,
    payload: row.payload ?? {},
    error_message: row.error_message ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
