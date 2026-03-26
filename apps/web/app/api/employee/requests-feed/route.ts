import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForRouteHandler } from "@/lib/supabase/route-handler-client";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { resolveEmployeeInActiveOrg } from "@/lib/helphub/employee-context";
import { fetchEmployeeRequestFeed } from "@/lib/helphub/requests/fetch-request-feeds";
import { fetchLatestRequestFeedDecisionNotesBySourceIds } from "@/lib/helphub/requests/fetch-request-feed-decision-notes";

export const dynamic = "force-dynamic";

/**
 * GET /api/employee/requests-feed?organizationId=
 * Auth: Bearer (iOS) or cookies. Returns normalized `hh_employee_requests_feed` rows + optional latest decision notes.
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

  const employeeId = await resolveEmployeeInActiveOrg(supabase, user.id, orgId);
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "EMPLOYEE_NOT_LINKED" }, { status: 403 });
  }

  const { items, error } = await fetchEmployeeRequestFeed(supabase, employeeId, 150);
  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  const sourceIds = items.map((i) => i.source_id);
  const notesMap =
    sourceIds.length > 0
      ? await fetchLatestRequestFeedDecisionNotesBySourceIds(supabase, orgId, sourceIds)
      : {};

  const itemsOut = items.map((row) => ({
    ...row,
    latest_decision_note: notesMap[row.source_id]?.notes?.trim() || null,
  }));

  return NextResponse.json({ ok: true, items: itemsOut });
}
