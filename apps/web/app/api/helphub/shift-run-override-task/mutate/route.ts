import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForRouteHandler } from "@/lib/supabase/route-handler-client";
import { resolveOrganizationIdForHelpHubApi } from "@/lib/helphub/org-context";
import { resolveEmployeeInActiveOrg } from "@/lib/helphub/employee-context";
import { mutateShiftRunOverrideTask } from "@/lib/helphub/shift-run-override-task-mutate";
import { shiftRunOverrideTaskMutateBodySchema } from "@/lib/validation/schemas";
import { checkHelpHubMutationRateLimit } from "@/lib/rateLimitDistributed";
import { logServerEvent } from "@/lib/observability/server-log";

/**
 * POST /api/helphub/shift-run-override-task/mutate
 * Body: { organizationId?, overrideTaskId, action, payload? } — Bearer (iOS) or cookies (web).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = shiftRunOverrideTaskMutateBodySchema.safeParse(body);
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

  const mutRl = await checkHelpHubMutationRateLimit(user.id);
  if (!mutRl.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
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

  const { overrideTaskId, action, payload } = parsed.data;
  const result = await mutateShiftRunOverrideTask(supabase, {
    organizationId: orgId,
    overrideTaskId,
    action,
    payload: payload as Record<string, unknown> | undefined,
  });

  if (!result.ok) {
    logServerEvent("helphub_override_task_mutate_rejected", {
      organization_id: orgId,
      user_id: user.id,
      override_task_id: overrideTaskId,
      action,
      error: "error" in result ? result.error : "unknown",
    });
  } else {
    logServerEvent("helphub_override_task_mutate_ok", {
      organization_id: orgId,
      user_id: user.id,
      override_task_id: overrideTaskId,
      action,
    });
  }

  return NextResponse.json(result);
}
