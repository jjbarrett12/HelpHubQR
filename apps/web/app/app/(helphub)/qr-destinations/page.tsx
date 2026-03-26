import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteQrDestinationForm } from "@/app/app/helphub/actions/qr-hub";
import type { QrDestinationType } from "@/lib/qr/types";

const TYPE_SHORT: Record<QrDestinationType, string> = {
  checklist: "Checklist",
  training: "Training",
  sop: "SOP",
  issue_report: "Issue",
  announcement: "News",
  help: "Help",
};

export const dynamic = "force-dynamic";

export default async function QrDestinationsPage() {
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
        <h1 className="text-lg font-semibold">QR destinations</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select an organization above.</p>
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("qr_destinations")
    .select("id, name, type, is_active, location_id, created_at")
    .eq("organization_id", orgId)
    .order("name");

  return (
    <div className="min-h-full">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 max-w-4xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">QR hub</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Destinations</h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              Define what a scan shows: checklists, training, SOPs, issue forms, announcements, or help. Then attach printed
              QR codes on{" "}
              <Link href="/app/qr-codes" className="text-primary underline underline-offset-4">
                QR codes
              </Link>
              .
            </p>
          </div>
          <Button asChild>
            <Link href="/app/qr-destinations/new">New destination</Link>
          </Button>
        </div>
      </header>

      <div className="p-6 md:p-8 max-w-4xl space-y-4">
        {(rows ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No destinations yet. Create one to start placing QR codes.</p>
        ) : (
          <ul className="space-y-2">
            {(rows ?? []).map((r) => (
              <li
                key={r.id as string}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/30 px-4 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium truncate">{r.name as string}</span>
                    <Badge variant="secondary">{TYPE_SHORT[r.type as QrDestinationType] ?? r.type}</Badge>
                    {!(r.is_active as boolean) ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactive
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at as string).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/app/qr-destinations/${r.id as string}/edit`}>Edit</Link>
                  </Button>
                  <form action={deleteQrDestinationForm}>
                    <input type="hidden" name="id" value={r.id as string} />
                    <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                      Delete
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
