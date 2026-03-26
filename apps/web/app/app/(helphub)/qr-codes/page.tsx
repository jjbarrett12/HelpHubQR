import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { Button } from "@/components/ui/button";
import { deleteQrCodeForm } from "@/app/app/helphub/actions/qr-hub";
import { publicQrScanUrl } from "@/lib/qr/urls";
import { QrCreateCodeForm } from "@/components/helphub/QrCreateCodeForm";
import { QrCopyLinkButton } from "@/components/helphub/QrCopyLinkButton";

export const dynamic = "force-dynamic";

export default async function QrCodesPage() {
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
        <h1 className="text-lg font-semibold">QR codes</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select an organization above.</p>
      </div>
    );
  }

  const [{ data: codes }, { data: destinations }, { data: locations }] = await Promise.all([
    supabase
      .from("qr_codes")
      .select("id, label, slug, created_at, qr_destination_id, location_id")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    supabase.from("qr_destinations").select("id, name, type").eq("organization_id", orgId).order("name"),
    supabase.from("locations").select("id, name").eq("organization_id", orgId).order("name"),
  ]);

  const destMap = new Map((destinations ?? []).map((d) => [d.id as string, d]));
  const locMap = new Map((locations ?? []).map((l) => [l.id as string, l.name as string]));

  return (
    <div className="min-h-full">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 max-w-4xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">QR hub</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Printed codes</h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              Each code has a stable link for signage. Manage what it shows under{" "}
              <Link href="/app/qr-destinations" className="text-primary underline underline-offset-4">
                Destinations
              </Link>
              .{" "}
              <Link href="/app/qr-issues" className="text-primary underline underline-offset-4">
                Issue reports
              </Link>{" "}
              from staff appear in a separate inbox.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/qr-destinations">Destinations</Link>
          </Button>
        </div>
      </header>

      <div className="p-6 md:p-8 max-w-4xl space-y-10">
        <QrCreateCodeForm
          destinations={(destinations ?? []) as { id: string; name: string; type: string }[]}
          locations={(locations ?? []) as { id: string; name: string }[]}
        />

        {(codes ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No QR codes yet. Generate one above.</p>
        ) : (
          <ul className="space-y-4">
            {(codes ?? []).map((c) => {
              const id = c.id as string;
              const slug = c.slug as string;
              const dest = destMap.get(c.qr_destination_id as string);
              const url = publicQrScanUrl(slug);
              const locName = c.location_id ? locMap.get(c.location_id as string) : null;
              return (
                <li
                  key={id}
                  className="rounded-xl border border-border/60 bg-card/30 p-4 flex flex-col gap-4 sm:flex-row sm:items-start"
                >
                  <div className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/qr/manager-image?codeId=${encodeURIComponent(id)}`}
                      alt=""
                      width={112}
                      height={112}
                      className="rounded-lg border border-border/60 bg-white p-1"
                      loading="lazy"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="font-medium">{c.label as string}</div>
                    <p className="text-sm text-muted-foreground">
                      → {dest ? `${dest.name as string} (${dest.type})` : "Unknown destination"}
                      {locName ? ` · ${locName}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground break-all font-mono">{url}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <QrCopyLinkButton url={url} />
                      <Button size="sm" variant="secondary" asChild>
                        <a href={`/api/qr/manager-image?codeId=${encodeURIComponent(id)}`} download>
                          Download PNG
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          Open preview
                        </a>
                      </Button>
                      <form action={deleteQrCodeForm}>
                        <input type="hidden" name="id" value={id} />
                        <Button type="submit" size="sm" variant="ghost" className="text-destructive">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
