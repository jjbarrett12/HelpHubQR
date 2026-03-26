import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { Button } from "@/components/ui/button";
import { ImportReviewClient } from "@/components/helphub/ImportReviewClient";

export default async function ChecklistImportReviewPage({ params }: { params: { documentId: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <div className="p-8 max-w-lg">
        <p className="text-sm text-muted-foreground">Select an organization first.</p>
      </div>
    );
  }

  const { data: doc, error: docErr } = await supabase
    .from("imported_documents")
    .select("*")
    .eq("id", params.documentId)
    .eq("organization_id", orgId)
    .single();

  if (docErr || !doc) notFound();

  const { data: taskRows } = await supabase
    .from("imported_document_tasks")
    .select("id, task_text, task_key, sort_order, is_selected")
    .eq("imported_document_id", params.documentId)
    .order("sort_order", { ascending: true });

  const [{ data: roles }, { data: locations }, { data: taxonomyRows }] = await Promise.all([
    supabase.from("staff_roles").select("id, name").eq("organization_id", orgId).order("name"),
    supabase.from("locations").select("id, name").eq("organization_id", orgId).order("name"),
    supabase
      .from("task_taxonomy")
      .select("task_key, display_label, is_active")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("display_label", { ascending: true }),
  ]);

  const taxonomy = (taxonomyRows ?? []) as { task_key: string; display_label: string; is_active?: boolean }[];

  const ai = (doc.ai_result as Record<string, unknown> | null) ?? null;
  const aiNotes = typeof ai?.notes === "string" ? ai.notes : null;

  return (
    <div className="min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review import</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm tasks before creating a checklist. Source file stays in private storage for audit.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/checklists?hub=import">Import hub</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/checklists/import">New upload</Link>
          </Button>
        </div>
      </header>
      <div className="p-6 md:p-8">
        {(roles ?? []).length === 0 ? (
          <div className="max-w-lg space-y-3 text-sm">
            <p className="text-muted-foreground">Create at least one staff role before saving a checklist.</p>
            <Button asChild>
              <Link href="/app/roles">Manage roles</Link>
            </Button>
          </div>
        ) : (
          <ImportReviewClient
            documentId={params.documentId}
            status={doc.status as string}
            checklistName={(doc.review_checklist_name as string | null) ?? "Imported checklist"}
            shiftType={(doc.review_shift_type as string | null) ?? null}
            tasks={(taskRows ?? []).map((t) => ({
              id: t.id as string,
              task_text: t.task_text as string,
              task_key: (t as { task_key?: string | null }).task_key ?? null,
              sort_order: t.sort_order as number,
              is_selected: Boolean(t.is_selected),
            }))}
            taxonomy={taxonomy}
            roles={(roles ?? []) as { id: string; name: string }[]}
            locations={(locations ?? []) as { id: string; name: string }[]}
            errorMessage={(doc.error_message as string | null) ?? null}
            aiNotes={aiNotes}
            ocrText={(doc.ocr_text as string | null) ?? null}
            parseConfidence={doc.ai_confidence != null ? Number(doc.ai_confidence) : null}
            ocrConfidence={doc.ocr_confidence != null ? Number(doc.ocr_confidence) : null}
          />
        )}
      </div>
    </div>
  );
}
