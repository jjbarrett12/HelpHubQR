import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TicketDetail } from "@/components/dashboard/TicketDetail";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select(`
      id, room_label_snapshot, request_type, note, status, priority, created_at, created_via,
      assigned_to, assigned_at, resolved_at,
      site_id, site:sites(name)
    `)
    .eq("id", ticketId)
    .single();
  if (!ticket) notFound();

  type SiteRelation = { name: string } | { name: string }[] | null;
  const rawSite = (ticket as { site?: SiteRelation }).site as SiteRelation;
  const site: { name: string } =
    Array.isArray(rawSite) ? rawSite[0] ?? { name: "" } : rawSite ?? { name: "" };

  const { data: events } = await supabase
    .from("ticket_events")
    .select("id, event_type, payload, created_at, actor_user_id")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  return (
    <div className="p-6 max-w-2xl">
      <TicketDetail
        ticket={{
          ...ticket,
          site,
        }}
        events={events ?? []}
      />
    </div>
  );
}
