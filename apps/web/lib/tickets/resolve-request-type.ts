import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedTicketRequestType = { id: string; code: string; label: string };

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function matchRows(
  rows: { id: string; code: string; label: string }[],
  raw: string
): ResolvedTicketRequestType | null {
  const lower = raw.toLowerCase();
  for (const row of rows) {
    if (row.code.trim().toLowerCase() === lower) return row;
  }
  const n = norm(raw);
  for (const row of rows) {
    if (norm(row.label) === n) return row;
  }
  return null;
}

/**
 * Prefer tenant-specific catalog rows, then global (tenant_id NULL). Unknown text maps to global `other`.
 */
export async function resolveTicketRequestType(
  supabase: SupabaseClient,
  tenantId: string,
  input: string | null | undefined
): Promise<ResolvedTicketRequestType | null> {
  const raw = input?.trim();
  if (!raw) return null;

  const { data: tenantRows } = await supabase
    .from("ticket_request_types")
    .select("id, code, label")
    .eq("active", true)
    .eq("tenant_id", tenantId);

  const fromTenant = matchRows(tenantRows ?? [], raw);
  if (fromTenant) return fromTenant;

  const { data: globalRows } = await supabase
    .from("ticket_request_types")
    .select("id, code, label")
    .eq("active", true)
    .is("tenant_id", null);

  const fromGlobal = matchRows(globalRows ?? [], raw);
  if (fromGlobal) return fromGlobal;

  const other = (globalRows ?? []).find((r) => r.code === "other");
  return other ?? null;
}
