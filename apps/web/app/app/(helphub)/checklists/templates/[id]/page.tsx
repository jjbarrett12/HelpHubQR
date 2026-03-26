import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { Button } from "@/components/ui/button";
import { ChecklistItemsEditor } from "@/components/helphub/ChecklistItemsEditor";
import { upsertChecklistFormAction } from "@/app/app/helphub/actions/checklists";
import { TemplateBuilderChrome } from "@/components/checklists/template/TemplateBuilderChrome";

const SHIFT_LABEL: Record<string, string> = {
  open: "Open",
  mid: "Mid",
  close: "Close",
  custom: "Custom",
};

export default async function ChecklistTemplateBuilderPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Select or create an organization first.</p>
      </div>
    );
  }

  const { data: checklist, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .single();
  if (error || !checklist) notFound();

  const [{ data: roles }, { data: locations }, { data: items }, { data: taxonomyRows }] = await Promise.all([
    supabase.from("staff_roles").select("id, name").eq("organization_id", orgId).order("name"),
    supabase.from("locations").select("id, name").eq("organization_id", orgId).order("name"),
    supabase.from("checklist_items").select("*").eq("checklist_id", id).order("sort_order", { ascending: true }),
    supabase
      .from("task_taxonomy")
      .select("task_key, display_label, is_active")
      .eq("organization_id", orgId)
      .order("display_label", { ascending: true }),
  ]);

  const taxonomy = (taxonomyRows ?? []) as Array<{ task_key: string; display_label: string; is_active?: boolean }>;

  const itemList = (items ?? []) as Array<{
    id: string;
    task_text: string;
    task_key?: string | null;
    sort_order: number;
    requires_photo: boolean;
    section_title?: string | null;
    duration_estimate_minutes?: number | null;
  }>;

  const uncategorizedCount = itemList.filter((i) => !i.task_key?.trim()).length;

  return (
    <div className="min-h-full flex flex-col">
      <TemplateBuilderChrome
        templateName={checklist.name as string}
        subtitle={`${SHIFT_LABEL[String(checklist.shift_type)] ?? checklist.shift_type} · Template ID ${id}`}
        isActive={Boolean(checklist.is_active)}
      />
      <div className="flex-1 p-4 md:p-6 max-w-3xl w-full mx-auto space-y-8 pb-12">
        <section className="rounded-lg border border-border/60 bg-card/30 p-4 space-y-3">
          <p className="text-sm font-semibold">Template metadata</p>
          <p className="text-xs text-muted-foreground">Role and station tags apply when matching this template to shifts.</p>
          <form action={upsertChecklistFormAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={id} />
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm">Name</label>
              <input
                name="name"
                defaultValue={checklist.name as string}
                required
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm">Description</label>
              <textarea
                name="description"
                defaultValue={(checklist.description as string | null) ?? ""}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm min-h-[72px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm">Role / station tag</label>
              <select
                name="staff_role_id"
                defaultValue={checklist.staff_role_id as string}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {(roles ?? []).map((r) => (
                  <option key={r.id as string} value={r.id as string}>
                    {r.name as string}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm">Shift type</label>
              <select
                name="shift_type"
                defaultValue={checklist.shift_type as string}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="open">Open</option>
                <option value="mid">Mid</option>
                <option value="close">Close</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm">Location scope</label>
              <select
                name="location_id"
                defaultValue={(checklist.location_id as string | null) ?? ""}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="">All locations</option>
                {(locations ?? []).map((l) => (
                  <option key={l.id as string} value={l.id as string}>
                    {l.name as string}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm">Template state</label>
              <select
                name="is_active"
                defaultValue={checklist.is_active ? "true" : "false"}
                className="w-full max-w-xs rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <Button type="submit">Save metadata</Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/app/checklists/import">Import from photo</Link>
              </Button>
            </div>
          </form>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Sections & tasks</p>
              <p className="text-xs text-muted-foreground">
                Order is execution order. Section titles group rows for scanning — sort order still wins for runs.
                {/* TODO: optional checklist_sections table if you outgrow a single section_title string */}
              </p>
            </div>
          </div>
          {uncategorizedCount > 0 ? (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm" role="status">
              <span className="font-medium text-amber-900 dark:text-amber-100">
                {uncategorizedCount} task{uncategorizedCount === 1 ? "" : "s"} without explicit task key
              </span>
              <span className="text-muted-foreground">
                {" "}
                — fairness and preferences work best with stable keys. Manage labels in{" "}
                <Link href="/app/task-taxonomy" className="underline underline-offset-2">
                  taxonomy
                </Link>
                .
              </span>
            </div>
          ) : null}
          <ChecklistItemsEditor checklistId={id} items={itemList} taxonomy={taxonomy} />
        </section>
      </div>
    </div>
  );
}
