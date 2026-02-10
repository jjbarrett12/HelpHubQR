import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Building2, ChevronRight, Inbox } from "lucide-react";

export default async function AppHomePage() {
  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites").select("id, name").order("name");

  if (!sites?.length) {
    const { redirect } = await import("next/navigation");
    redirect("/app/admin/sites");
  }

  const openCounts = await Promise.all(
    sites.map(async (site) => {
      const { count } = await supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("site_id", site.id)
        .in("status", ["new", "in_progress"]);
      return { siteId: site.id, name: site.name, open: count ?? 0 };
    })
  );

  return (
    <div className="min-h-full">
      <header className="border-b border-border/50 bg-[var(--app-bg)]/80 backdrop-blur-md px-6 py-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Select a site to view tickets and activity.</p>
      </header>
      <div className="p-6 md:p-8 max-w-5xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {openCounts.map(({ siteId, name, open }) => (
            <Link
              key={siteId}
              href={`/app/sites/${siteId}`}
              className="group premium-card flex items-center gap-4 rounded-2xl border border-border/60 p-5 transition hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">{name}</p>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Inbox className="h-4 w-4" />
                  {open} open
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
