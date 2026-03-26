import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForRouteHandler } from "@/lib/supabase/route-handler-client";
import { resolveOrganizationIdForHelpHubApi } from "@/lib/helphub/org-context";
import { resolveEmployeeInActiveOrg } from "@/lib/helphub/employee-context";
import { mutateShiftChecklistRunItem } from "@/lib/helphub/shift-checklist-run-item-mutate";
import { shiftChecklistRunItemMutateBodySchema } from "@/lib/validation/schemas";
import { checkHelpHubMutationRateLimit } from "@/lib/rateLimitDistributed";
import { logServerEvent } from "@/lib/observability/server-log";

/**
 * Same contract as `mutateShiftChecklistRunItemAction` — **Bearer** (iOS) or cookie session (web).
 * Returns JSON body `{ ok, ... }` for all logical outcomes; HTTP errors only for transport/auth.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = shiftChecklistRunItemMutateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseForRouteHandler(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const orgResolved = await resolveOrganizationIdForHelpHubApi(
    supabase,
    user.id,
    parsed.data.organizationId
  );
  if ("error" in orgResolved) {
    const status = orgResolved.error === "NOT_ORG_MEMBER" ? 403 : 400;
    return NextResponse.json({ ok: false, error: orgResolved.error }, { status });
  }
  const orgId = orgResolved.organizationId;

  const employeeId = await resolveEmployeeInActiveOrg(supabase, user.id, orgId);
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "EMPLOYEE_NOT_LINKED" }, { status: 403 });
  }

  const { runItemId, action, payload } = parsed.data;
  const result = await mutateShiftChecklistRunItem(supabase, {
    organizationId: orgId,
    runItemId,
    action,
    payload: payload as Record<string, unknown> | undefined,
  });

  if (!result.ok) {
    logServerEvent("helphub_run_item_mutate_rejected", {
      organization_id: orgId,
      user_id: user.id,
      run_item_id: runItemId,
      action,
      error: "error" in result ? result.error : "unknown",
    });
  } else {
    logServerEvent("helphub_run_item_mutate_ok", {
      organization_id: orgId,
      user_id: user.id,
      run_item_id: runItemId,
      action,
    });
  }

  return NextResponse.json(result);
}
