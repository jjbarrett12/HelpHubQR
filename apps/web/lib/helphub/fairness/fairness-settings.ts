import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTaskKey } from "./task-key";

export type OrganizationFairnessSettings = {
  undesirable_shift_types: string[];
  undesirable_weekdays: number[];
  undesirable_task_keys: string[];
  fairness_lookback_days: number;
  enable_fairness_warnings: boolean;
};

function parseJsonStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string") as string[];
}

function parseJsonNumberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "number" && Number.isFinite(x)) as number[];
}

function normalizeUndesirableTaskKeys(raw: string[]): string[] {
  return [
    ...new Set(
      raw
        .map((k) => normalizeTaskKey(k))
        .filter((k) => k.length > 0 && k !== "unnamed_task")
    ),
  ];
}

export async function fetchOrCreateOrganizationFairnessSettings(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrganizationFairnessSettings> {
  const { data: row } = await supabase
    .from("organization_fairness_settings")
    .select(
      "undesirable_shift_types, undesirable_weekdays, undesirable_task_keys, fairness_lookback_days, enable_fairness_warnings"
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (row) {
    const r = row as Record<string, unknown>;
    return {
      undesirable_shift_types: parseJsonStringArray(r.undesirable_shift_types),
      undesirable_weekdays: parseJsonNumberArray(r.undesirable_weekdays),
      undesirable_task_keys: normalizeUndesirableTaskKeys(parseJsonStringArray(r.undesirable_task_keys)),
      fairness_lookback_days: Number(r.fairness_lookback_days) || 30,
      enable_fairness_warnings: r.enable_fairness_warnings !== false,
    };
  }

  const { error: insErr } = await supabase.from("organization_fairness_settings").insert({
    organization_id: organizationId,
  });
  if (insErr) throw new Error(insErr.message);

  const { data: created, error: fErr } = await supabase
    .from("organization_fairness_settings")
    .select(
      "undesirable_shift_types, undesirable_weekdays, undesirable_task_keys, fairness_lookback_days, enable_fairness_warnings"
    )
    .eq("organization_id", organizationId)
    .single();

  if (fErr || !created) throw new Error(fErr?.message ?? "organization_fairness_settings missing");
  const r = created as Record<string, unknown>;
  return {
    undesirable_shift_types: parseJsonStringArray(r.undesirable_shift_types),
    undesirable_weekdays: parseJsonNumberArray(r.undesirable_weekdays),
    undesirable_task_keys: normalizeUndesirableTaskKeys(parseJsonStringArray(r.undesirable_task_keys)),
    fairness_lookback_days: Number(r.fairness_lookback_days) || 30,
    enable_fairness_warnings: r.enable_fairness_warnings !== false,
  };
}
