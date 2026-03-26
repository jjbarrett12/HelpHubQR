import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { userCanManageOrganization } from "@/lib/helphub/require-org";
import { ModulePlaceholder } from "@/components/manager-shell/ModulePlaceholder";
import { TodayCommandCenter } from "@/components/today-command-center";
import { loadTodayCommandCenterSnapshot } from "@/lib/helphub/today/loadTodayCommandCenterSnapshot";
import { fetchManagerRequestFeed } from "@/lib/helphub/requests/fetch-request-feeds";
import { mapRequestFeedItemToApprovalInboxItem } from "@/lib/helphub/requests/map-request-feed-to-approval-inbox";
import { isManagerTodayApprovalActionable } from "@/lib/helphub/requests/feed-dispatch";
import { fetchLatestRequestFeedDecisionNotesBySourceIds } from "@/lib/helphub/requests/fetch-request-feed-decision-notes";

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <ModulePlaceholder
        kicker="Operations"
        title="Today"
        description="Pick an organization in the top bar to open the command center."
        body="The manager today view is scoped to one HelpHub organization. Select or create an org above, then return here for staffing, execution, and approvals in one screen."
        nextSteps={[
          { label: "Schedule", href: "/app/schedule" },
          { label: "Shift operations", href: "/app/shift-ops" },
        ]}
        dataHookNote="resolveActiveOrganizationId → TodayCommandCenter + loadTodayCommandCenterSnapshot (TODO)."
      />
    );
  }

  const { data: orgRow } = await supabase.from("organizations").select("name").eq("id", orgId).single();
  const organizationName = (orgRow?.name as string) ?? "Organization";

  const snapshot = await loadTodayCommandCenterSnapshot(supabase, orgId);
  const canManage = await userCanManageOrganization(supabase, user.id, orgId);

  const { items: pendingFeed, error: approvalsErr } = await fetchManagerRequestFeed(supabase, orgId, {
    includeHistorical: false,
    limit: 30,
  });

  let pendingApprovals = snapshot.data.approvals;
  let approvalsActionsEnabled = false;

  if (!approvalsErr) {
    const actionableItems = pendingFeed.filter(isManagerTodayApprovalActionable);
    const notesMap =
      actionableItems.length > 0
        ? await fetchLatestRequestFeedDecisionNotesBySourceIds(
            supabase,
            orgId,
            actionableItems.map((r) => r.source_id)
          )
        : {};
    pendingApprovals = actionableItems.map((row) => {
      const item = mapRequestFeedItemToApprovalInboxItem(row);
      const n = notesMap[row.source_id]?.notes?.trim();
      return { ...item, latestDecisionNote: n || null };
    });
    approvalsActionsEnabled = true;
  }

  const data = {
    ...snapshot.data,
    approvals: pendingApprovals,
  };
  const dataSource = snapshot.source === "mock" ? "mock" : "live";

  return (
    <TodayCommandCenter
      organizationId={orgId}
      organizationName={organizationName}
      data={data}
      dataSource={dataSource}
      approvalsFeedError={approvalsErr}
      canManageApprovals={canManage}
      approvalsActionsEnabled={approvalsActionsEnabled}
    />
  );
}
