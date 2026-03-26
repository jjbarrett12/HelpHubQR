"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/helphub/require-org";
import { userCanManageOrganization } from "@/lib/helphub/require-org";
import {
  createOperationalMessage,
  type CreateOperationalMessageParams,
} from "@/lib/helphub/operational-messages";

/**
 * Manager-only: create a one-way operational message (broadcast or targeted).
 */
export async function createOperationalMessageAction(
  params: CreateOperationalMessageParams
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { supabase, orgId, user } = ctx;

  const can = await userCanManageOrganization(supabase, user.id, orgId);
  if (!can) return { ok: false, error: "Manager access required" };

  const out = await createOperationalMessage(supabase, orgId, params);
  if (!out.ok) return out;

  revalidatePath("/app/dashboard");
  return { ok: true, id: out.id };
}
