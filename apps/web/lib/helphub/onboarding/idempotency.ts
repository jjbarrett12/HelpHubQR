import type { ServiceSupabase } from "./types";

const PG_UNIQUE_VIOLATION = "23505";

export async function hasSucceededProvisioning(
  admin: ServiceSupabase,
  organizationId: string,
  idempotencyKey: string
): Promise<boolean> {
  const { data } = await admin
    .from("organization_provisioning_events")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("idempotency_key", idempotencyKey)
    .in("status", ["succeeded", "skipped"])
    .maybeSingle();
  return !!data;
}

export type IdempotentRunResult<T> =
  | { ok: true; skipped: true; reason: "idempotent_hit" }
  | { ok: true; skipped: false; data: T }
  | { ok: false; error: string };

/**
 * Runs a side effect once per (org, idempotencyKey) for succeeded outcomes.
 * Records organization_provisioning_events on success or failure.
 */
export async function runWithIdempotency<T>(
  admin: ServiceSupabase,
  organizationId: string,
  eventType: string,
  idempotencyKey: string,
  fn: () => Promise<T>
): Promise<IdempotentRunResult<T>> {
  if (await hasSucceededProvisioning(admin, organizationId, idempotencyKey)) {
    return { ok: true, skipped: true, reason: "idempotent_hit" };
  }
  try {
    const data = await fn();
    const { error } = await admin.from("organization_provisioning_events").insert({
      organization_id: organizationId,
      event_type: eventType,
      status: "succeeded",
      idempotency_key: idempotencyKey,
      payload: {},
    });
    if (error?.code === PG_UNIQUE_VIOLATION) {
      return { ok: true, skipped: true, reason: "idempotent_hit" };
    }
    if (error) return { ok: false, error: error.message };
    return { ok: true, skipped: false, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("organization_provisioning_events").insert({
      organization_id: organizationId,
      event_type: eventType,
      status: "failed",
      idempotency_key: `${idempotencyKey}:failed:${crypto.randomUUID()}`,
      error_message: msg,
      payload: {},
    });
    return { ok: false, error: msg };
  }
}
