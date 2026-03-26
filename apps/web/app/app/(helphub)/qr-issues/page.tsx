import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function QrIssuesPage() {
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
        <h1 className="text-lg font-semibold">QR issue reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select an organization above.</p>
      </div>
    );
  }

  const { data: reports } = await supabase
    .from("qr_issue_reports")
    .select("id, message, contact, created_at, qr_code_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(150);

  const codeIds = [...new Set((reports ?? []).map((r) => r.qr_code_id as string))];
  const { data: codeRows } =
    codeIds.length > 0
      ? await supabase.from("qr_codes").select("id, label, slug").in("id", codeIds)
      : { data: [] as { id: string; label: string; slug: string }[] };

  const codeMap = new Map((codeRows ?? []).map((c) => [c.id as string, c]));

  return (
    <div className="min-h-full">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center gap-3 max-w-4xl">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app/qr-codes">← QR codes</Link>
          </Button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">QR hub</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Issue reports</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Submissions from &quot;issue report&quot; QR destinations (staff scans).
            </p>
          </div>
        </div>
      </header>

      <div className="p-6 md:p-8 max-w-4xl space-y-4">
        {(reports ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports yet.</p>
        ) : (
          <ul className="space-y-3">
            {(reports ?? []).map((r) => {
              const code = codeMap.get(r.qr_code_id as string);
              return (
                <li key={r.id as string} className="rounded-xl border border-border/60 bg-card/30 p-4 space-y-2">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>{new Date(r.created_at as string).toLocaleString()}</span>
                    {code ? (
                      <span>
                        QR: {code.label as string}
                        <span className="font-mono opacity-70"> · {code.slug as string}</span>
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.message as string}</p>
                  {(r.contact as string | null)?.trim() ? (
                    <p className="text-xs text-muted-foreground">Contact: {r.contact as string}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
