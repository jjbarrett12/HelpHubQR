import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { loadShiftRunReviewViewModel } from "@/lib/checklists/load-shift-run-review";
import { MOCK_RUN_REVIEW_DETAIL } from "@/lib/checklists/mock-data";
import type { RunReviewViewModel } from "@/lib/checklists/run-review-view-model";
import { ShiftRunReviewView } from "@/components/checklists/run/ShiftRunReviewView";

export default async function ChecklistRunReviewPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <div className="p-8 max-w-lg text-sm text-muted-foreground">
        Select an organization to review shift runs.
      </div>
    );
  }

  if (params.id === "demo") {
    const model = MOCK_RUN_REVIEW_DETAIL as RunReviewViewModel;
    return <ShiftRunReviewView model={model} backHref="/app/checklists?hub=runs" />;
  }

  const model = await loadShiftRunReviewViewModel(supabase, { organizationId: orgId, runId: params.id });
  if (!model) notFound();

  return <ShiftRunReviewView model={model} backHref="/app/checklists?hub=runs" />;
}
