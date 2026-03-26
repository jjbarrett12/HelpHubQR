"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { provisionOrganization } from "@/lib/helphub/onboarding/provision-organization";
import type { ProvisionIndustry, ProvisionOrganizationInput } from "@/lib/helphub/onboarding/types";

/**
 * Self-serve workspace creation. Caller must be logged in; owner is always the session user.
 * Runs with service role after auth check — never call from client without this server action.
 */
export async function selfServeProvisionWorkspace(
  input: Omit<ProvisionOrganizationInput, "mode" | "owner"> & {
    owner?: never;
  }
): Promise<import("@/lib/helphub/onboarding/types").ProvisionOrganizationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email?.trim()) {
    return {
      success: false,
      dataSource: "created",
      idempotencyKey: input.idempotencyKey ?? "",
      steps: [{ stepKey: "auth", status: "failed", detail: "Not authenticated" }],
      warnings: [],
      errors: ["Not authenticated"],
    };
  }

  const industry = (input.organization.industry ?? "other") as ProvisionIndustry;

  const full: ProvisionOrganizationInput = {
    ...input,
    mode: "self_serve",
    organization: {
      ...input.organization,
      industry,
    },
    owner: {
      authUserId: user.id,
      email: user.email.trim(),
      firstName: user.user_metadata?.first_name ?? null,
      lastName: user.user_metadata?.last_name ?? null,
    },
    starterPack: input.starterPack ?? {
      key: industry === "other" ? null : industry,
      enabled: true,
    },
  };

  const admin = createServiceRoleClient();
  return provisionOrganization(admin, full);
}
