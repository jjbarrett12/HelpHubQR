import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModulePlaceholder } from "@/components/manager-shell/ModulePlaceholder";

export default async function IssuesPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  return (
    <ModulePlaceholder
      kicker="Workplace"
      title="Issues"
      description="Operational problems surfaced from the field—QR scans, checklists, or guest reports."
      body="This route is the manager-facing issues stream (placeholder). It should prioritize what’s blocking tonight’s shift, not long-term ticket backlogs. Link out to detailed inboxes until unified."
      nextSteps={[
        { label: "QR issue inbox", href: "/app/qr-issues" },
        { label: "Tickets (legacy)", href: "/app/dashboard" },
      ]}
      dataHookNote="qr_issue_reports + future cross-source issue rollup; filter by organization_id and open state."
    />
  );
}
