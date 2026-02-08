import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TicketList } from "@/components/dashboard/TicketList";
import { TicketFilters } from "@/components/dashboard/TicketFilters";
import { IssueStats } from "@/components/dashboard/IssueStats";
import { EnablePushNotifications } from "@/components/dashboard/EnablePushNotifications";

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
          <TicketFilters siteId={siteId} />
        </div>
        <TicketList siteId={siteId} />
      </section>
    </div>
  );
}
