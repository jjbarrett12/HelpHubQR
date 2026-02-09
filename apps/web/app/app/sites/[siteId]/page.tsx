import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TicketList } from "@/components/dashboard/TicketList";
import { TicketFilters } from "@/components/dashboard/TicketFilters";
import { IssueStats } from "@/components/dashboard/IssueStats";
import { EnablePushNotifications } from "@/components/dashboard/EnablePushNotifications";
import { AddTicketDialog } from "@/components/dashboard/AddTicketDialog";
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
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{site.name}</h1>
        <EnablePushNotifications siteId={siteId} />
      </div>
      <IssueStats siteId={siteId} />
      <section aria-labelledby="tickets-heading">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 id="tickets-heading" className="text-lg font-medium text-foreground">
            Tickets
          </h2>
          <div className="flex items-center gap-2">
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
  );
}
