import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { resolveEmployeeInActiveOrg } from "@/lib/helphub/employee-context";
import { EmployeeMyRequestsClient } from "@/components/helphub/workforce/EmployeeMyRequestsClient";
import { fetchEmployeeRequestFeed } from "@/lib/helphub/requests/fetch-request-feeds";
import { mapRequestFeedToEmployeeBuckets } from "@/lib/helphub/requests/map-request-feed-to-employee-buckets";
import { fetchLatestRequestFeedDecisionNotesBySourceIds } from "@/lib/helphub/requests/fetch-request-feed-decision-notes";

export default async function MyRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <div className="p-6 max-w-lg">
        <h1 className="text-lg font-semibold">My requests</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select an organization above.</p>
      </div>
    );
  }

  const employeeId = await resolveEmployeeInActiveOrg(supabase, user.id, orgId);
  if (!employeeId) {
    return (
      <div className="p-6 max-w-lg space-y-3">
        <h1 className="text-lg font-semibold">My requests</h1>
        <p className="text-sm text-muted-foreground">
          Link your account to an employee profile to see task transfers and trades.
        </p>
        <Link href="/app/employees" className="text-sm text-primary underline">
          Go to Employees
        </Link>
      </div>
    );
  }

  const { items: feedItems, error: feedErr } = await fetchEmployeeRequestFeed(supabase, employeeId, 120);

  const sourceIds = feedErr ? [] : feedItems.map((r) => r.source_id);
  const latestNotes =
    sourceIds.length > 0
      ? await fetchLatestRequestFeedDecisionNotesBySourceIds(supabase, orgId, sourceIds)
      : {};
  const latestDecisionNoteBySourceId: Record<string, string | undefined | null> = {};
  for (const sid of sourceIds) {
    const n = latestNotes[sid]?.notes?.trim();
    if (n) latestDecisionNoteBySourceId[sid] = n;
  }

  const { transfers, coverage, trades } = mapRequestFeedToEmployeeBuckets(
    feedErr ? [] : feedItems,
    employeeId,
    { latestDecisionNoteBySourceId }
  );

  return (
    <div className="min-h-full">
      <div className="border-b bg-card/40 px-4 py-4">
        <h1 className="text-xl font-semibold">My requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Transfers, coverage, and trades from the unified workforce requests feed.{" "}
          <Link href="/app/my-shifts" className="text-primary underline">
            Shifts &amp; open claims
          </Link>
        </p>
        {feedErr ? (
          <p className="text-sm text-destructive mt-2">
            Could not load request feed: {feedErr}. Apply migration{" "}
            <code className="text-xs">20260429180000_hh_request_feeds</code>.
          </p>
        ) : null}
      </div>
      <EmployeeMyRequestsClient
        employeeId={employeeId}
        transfers={transfers}
        coverage={coverage}
        trades={trades}
      />
    </div>
  );
}
