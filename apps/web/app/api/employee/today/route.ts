import { NextRequest, NextResponse } from "next/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { DEFAULT_TIMEZONE } from "@/lib/date";
import { fetchEmployeeTodayBundle } from "@/lib/helphub/employee-today/fetch-employee-today-bundle";
import { createSupabaseForRouteHandler } from "@/lib/supabase/route-handler-client";

export const dynamic = "force-dynamic";

/**
 * GET /api/employee/today?organizationId=<uuid>&timeZone=America%2FDenver
 * Auth: `Authorization: Bearer <supabase_access_token>` (iOS) or session cookies (web).
 * Response: canonical camelCase `EmployeeTodayBundle` (same shape as mapping RPC for web).
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseForRouteHandler(req);
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "NOT_AUTHENTICATED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const orgFromQuery = url.searchParams.get("organizationId");
  const orgId = orgFromQuery ?? (await resolveActiveOrganizationId(supabase, user.id));
  if (!orgId) {
    return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 400 });
  }

  const timeZone =
    url.searchParams.get("timeZone")?.trim() ||
    process.env.CRON_SCHEDULE_TZ?.trim() ||
    DEFAULT_TIMEZONE;

  const bundle = await fetchEmployeeTodayBundle(supabase, { organizationId: orgId, timeZone });
  if (!bundle.ok) {
    const status =
      bundle.error === "NOT_AUTHENTICATED"
        ? 401
        : bundle.error === "NO_ORGANIZATION"
          ? 400
          : bundle.error === "NOT_ORG_MEMBER" || bundle.error === "EMPLOYEE_NOT_LINKED"
            ? 403
            : bundle.error === "INVALID_RESPONSE"
              ? 502
              : 500;
    return NextResponse.json(bundle, { status });
  }

  return NextResponse.json(bundle);
}
