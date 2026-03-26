import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { Button } from "@/components/ui/button";
import { ImportUploadForm } from "@/components/helphub/ImportUploadForm";

export default async function ChecklistImportPage() {
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
        <h1 className="text-lg font-semibold">Import checklist</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select or create an organization first.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-border/50 px-6 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Import checklist from photo</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Upload a photo of a printed or handwritten duty list. Server-side OCR extracts text, then AI proposes a name,
          shift type, and tasks. You review and edit before anything is saved as a live checklist.
        </p>
      </header>
      <div className="p-6 md:p-8 space-y-6">
        <ImportUploadForm />
        <Button variant="outline" asChild>
          <Link href="/app/checklists?hub=import">Back to checklist hub</Link>
        </Button>
      </div>
    </div>
  );
}
