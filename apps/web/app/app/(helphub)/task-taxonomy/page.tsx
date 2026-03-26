import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { userCanManageOrganization } from "@/lib/helphub/require-org";
import { normalizeTaskKey } from "@/lib/helphub/fairness/task-key";
import {
  fetchTaskKeyManagerInsights,
  fetchTaxonomyUsageByKey,
  type TaxonomyRow,
} from "@/lib/helphub/task-taxonomy";
import { TaskTaxonomyClient, type TaxonomyListRow } from "@/components/helphub/TaskTaxonomyClient";
import { Button } from "@/components/ui/button";

export default async function TaskTaxonomyPage() {
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
        <p className="text-sm text-muted-foreground">Select an organization first.</p>
      </div>
    );
  }

  const canManage = await userCanManageOrganization(supabase, user.id, orgId);

  const { data: taxRows, error: tErr } = await supabase
    .from("task_taxonomy")
    .select("id, task_key, display_label, description, is_active, created_at, updated_at")
    .eq("organization_id", orgId)
    .order("display_label", { ascending: true });
  if (tErr) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Could not load taxonomy: {tErr.message}</p>
      </div>
    );
  }

  const taxonomy = (taxRows ?? []) as TaxonomyRow[];
  const usageMap = canManage ? await fetchTaxonomyUsageByKey(supabase, orgId, taxonomy) : new Map();
  const insights = canManage ? await fetchTaskKeyManagerInsights(supabase, orgId) : null;

  const initialRows: TaxonomyListRow[] = (taxRows ?? []).map((r) => {
    const task_key = r.task_key as string;
    const nk = normalizeTaskKey(task_key);
    const u = usageMap.get(nk);
    return {
      id: r.id as string,
      task_key,
      display_label: r.display_label as string,
      description: (r.description as string | null) ?? null,
      is_active: Boolean(r.is_active),
      checklist_item_count: u?.checklistItems ?? 0,
      run_snapshot_count: u?.runSnapshots ?? 0,
    };
  });

  return (
    <div className="min-h-full">
      <header className="border-b bg-card/40 px-4 py-4 md:px-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Task taxonomy</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Canonical keys and labels for operational fairness — optional metadata only. Execution still uses checklist
            items and run snapshots; we never rewrite historical keys automatically.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/checklists">Checklists</Link>
        </Button>
      </header>
      <div className="p-4 md:p-6">
        {!canManage ? (
          <p className="text-sm text-muted-foreground mb-4">
            You can view taxonomy entries. Only managers can add or edit them.
          </p>
        ) : null}
        <TaskTaxonomyClient initialRows={initialRows} canManage={canManage} insights={insights} />
      </div>
    </div>
  );
}
