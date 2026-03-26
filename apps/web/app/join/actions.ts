"use server";

import { createClient } from "@/lib/supabase/server";
import { formatTenantInviteAcceptError } from "@/lib/tenant/invite-errors";

type AcceptInviteResult =
  | { ok: true; tenantId: string }
  | { ok: false; error: string };

export async function acceptTenantInviteAction(token: string): Promise<AcceptInviteResult> {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > 256) {
    return { ok: false, error: "Paste the full invite code you were given." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, error: "Sign in first, using the same email as the invite." };
  }

  const { data, error } = await supabase.rpc("hh_tenant_accept_invite", { p_token: trimmed });
  if (error) {
    console.error("[accept-invite] rpc_error", { code: error.code, message: error.message });
    return { ok: false, error: "Could not accept the invite. Try again in a moment." };
  }

  const row = data as { ok?: boolean; error?: string; tenant_id?: string } | null;
  if (!row?.ok) {
    return { ok: false, error: formatTenantInviteAcceptError(row?.error) };
  }
  const tenantId = row.tenant_id;
  if (!tenantId || typeof tenantId !== "string") {
    return { ok: false, error: "Invite accepted but tenant could not be resolved. Contact support." };
  }

  return { ok: true, tenantId };
}
