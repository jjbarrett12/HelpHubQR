import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgWorkforceSettings = {
  allow_employee_task_offers: boolean;
  allow_open_shift_claims: boolean;
  allow_shift_trades: boolean;
  manager_approval_required_for_task_transfer: boolean;
  manager_approval_required_for_shift_claim: boolean;
  manager_approval_required_for_shift_trade: boolean;
  allow_cross_role_claims: boolean;
};

export async function fetchOrCreateWorkforceSettings(
  supabase: SupabaseClient,
  organizationId: string
): Promise<OrgWorkforceSettings> {
  const { data: row } = await supabase
    .from("organization_workforce_settings")
    .select(
      "allow_employee_task_offers, allow_open_shift_claims, allow_shift_trades, manager_approval_required_for_task_transfer, manager_approval_required_for_shift_claim, manager_approval_required_for_shift_trade, allow_cross_role_claims"
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (row) return row as OrgWorkforceSettings;

  const { error: insErr } = await supabase.from("organization_workforce_settings").insert({
    organization_id: organizationId,
  });
  if (insErr) throw new Error(insErr.message);

  const { data: created, error: fErr } = await supabase
    .from("organization_workforce_settings")
    .select(
      "allow_employee_task_offers, allow_open_shift_claims, allow_shift_trades, manager_approval_required_for_task_transfer, manager_approval_required_for_shift_claim, manager_approval_required_for_shift_trade, allow_cross_role_claims"
    )
    .eq("organization_id", organizationId)
    .single();

  if (fErr || !created) throw new Error(fErr?.message ?? "Workforce settings missing");
  return created as OrgWorkforceSettings;
}
