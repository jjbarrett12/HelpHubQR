import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { getSupervisorPropertyForUser } from "@/lib/operations/supervisor-context";
import { PropertyRequestTypesTemplates } from "@/components/operations/PropertyRequestTypesTemplates";
import { ChecklistsHubNav } from "@/components/checklists/hub/ChecklistsHubNav";
import {
  HistoryHubSection,
  ImportHubSection,
  parseHubParam,
  RunsHubSection,
  TaxonomyHubSection,
  TemplatesHubSection,
} from "@/components/checklists/hub/hub-sections";

export default async function ChecklistsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    const supervisor = await getSupervisorPropertyForUser(user.id);
    if (supervisor) {
      return <PropertyRequestTypesTemplates propertyId={supervisor.propertyId} />;
    }
    return (
      <div className="p-8 max-w-lg">
        <h1 className="text-lg font-semibold">Checklists</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Select or create an organization above, or get supervisor access to a property for guest-request templates.
        </p>
      </div>
    );
  }

  const hub = parseHubParam(searchParams);

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-4 py-5 md:px-6 lg:px-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Operations</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight md:text-3xl">Checklists</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Templates define work. Runs record what happened on shift. Keep those two apart — switch sections below.
        </p>
      </header>
      <Suspense fallback={<div className="h-10 border-b border-border/60 bg-muted/10" />}>
        <ChecklistsHubNav activeHub={hub} />
      </Suspense>
      {hub === "templates" && <TemplatesHubSection orgId={orgId} />}
      {hub === "runs" && <RunsHubSection orgId={orgId} />}
      {hub === "import" && <ImportHubSection orgId={orgId} />}
      {hub === "history" && <HistoryHubSection orgId={orgId} />}
      {hub === "taxonomy" && <TaxonomyHubSection />}
    </div>
  );
}
