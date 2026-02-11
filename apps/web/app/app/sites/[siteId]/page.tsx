import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TicketList } from "@/components/dashboard/TicketList";
import { TicketFilters } from "@/components/dashboard/TicketFilters";
import { IssueStats } from "@/components/dashboard/IssueStats";
import { EnablePushNotifications } from "@/components/dashboard/EnablePushNotifications";
import { AddTicketDialog } from "@/components/dashboard/AddTicketDialog";
import { ExportTicketsButton } from "@/components/dashboard/ExportTicketsButton";
import { naturalCompare } from "@/lib/utils";

export default async function SiteDashboardPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, name")
    .eq("id", siteId)
    .single();
  if (!site) notFound();

  const { data: roomsRaw } = await supabase
    .from("rooms")
    .select("id, room_label")
    .eq("site_id", siteId)
    .order("room_label");
  const rooms = (roomsRaw ?? []).sort((a, b) =>
    naturalCompare(a.room_label ?? "", b.room_label ?? "")
  );

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-[var(--app-bg)]/80 backdrop-blur-md px-6 py-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{site.name}</h1>
          <EnablePushNotifications siteId={siteId} />
        </div>
      </header>
      <div className="p-6 md:p-8 space-y-10 max-w-6xl">
        <IssueStats siteId={siteId} />
        <section aria-labelledby="tickets-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="tickets-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tickets
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <ExportTicketsButton siteId={siteId} />
              <AddTicketDialog
              siteId={siteId}
              siteName={site.name}
              rooms={rooms}
            />
              <TicketFilters siteId={siteId} />
            </div>
          </div>
          <TicketList siteId={siteId} />
        </section>
      </div>
    </div>
  );
}
