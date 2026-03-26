/** Shape of public.tenant_onboarding (read from Supabase). */
export type TenantOnboardingRow = {
  tenant_id: string;
  status: "not_started" | "in_progress" | "completed";
  primary_admin_user_id: string | null;
  sites_created_count: number;
  rooms_created_count: number;
  first_ticket_created_at: string | null;
  completed_at: string | null;
};

export function isTenantOnboardingComplete(row: Pick<TenantOnboardingRow, "status" | "completed_at">): boolean {
  return row.status === "completed" && row.completed_at != null;
}

/** Enough QR surface to consider rollout “real” (product heuristic; DB stays source for counts). */
export function isQrRolloutLikelyComplete(row: Pick<TenantOnboardingRow, "sites_created_count" | "rooms_created_count">): boolean {
  return row.sites_created_count > 0 && row.rooms_created_count > 0;
}

export function activeStaffInviteSuggested(
  row: Pick<TenantOnboardingRow, "sites_created_count">,
  activeNonAdminMemberCount: number
): boolean {
  return row.sites_created_count > 0 && activeNonAdminMemberCount === 0;
}
