import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { Button } from "@/components/ui/button";
import { QrDestinationEditor } from "@/components/helphub/QrDestinationEditor";
import type { QrDestinationContent, QrDestinationType } from "@/lib/qr/types";
import { parseQrDestinationType } from "@/lib/qr/types";

export const dynamic = "force-dynamic";

export default async function EditQrDestinationPage({ params }: { params: { id: string } }) {
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
        <h1 className="text-lg font-semibold">Edit destination</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select an organization above.</p>
      </div>
    );
  }

  const { data: row, error: fetchErr } = await supabase
    .from("qr_destinations")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .single();

  if (fetchErr || !row) notFound();

  const t = parseQrDestinationType(row.type as string);
  if (!t) notFound();

  const [{ data: checklists }, { data: locations }] = await Promise.all([
    supabase.from("checklists").select("id, name").eq("organization_id", orgId).order("name"),
    supabase.from("locations").select("id, name").eq("organization_id", orgId).order("name"),
  ]);

  const initial = {
    id: row.id as string,
    name: row.name as string,
    type: t,
    location_id: (row.location_id as string | null) ?? null,
    target_checklist_id: (row.target_checklist_id as string | null) ?? null,
    content: (row.content as QrDestinationContent | null) ?? null,
    is_active: row.is_active !== false,
  };

  return (
    <div className="min-h-full">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center gap-3 max-w-4xl">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/qr-destinations">← Destinations</Link>
          </Button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">QR hub</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Edit destination</h1>
          </div>
        </div>
      </header>
      <div className="p-6 md:p-8 max-w-4xl">
        <QrDestinationEditor
          mode="edit"
          checklists={(checklists ?? []) as { id: string; name: string }[]}
          locations={(locations ?? []) as { id: string; name: string }[]}
          initial={initial}
        />
      </div>
    </div>
  );
}
