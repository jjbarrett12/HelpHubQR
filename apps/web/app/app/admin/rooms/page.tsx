import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { naturalCompare } from "@/lib/utils";
import { isRoomTokenActive } from "@/lib/room-token/active";
import { RoomCsvUploader } from "@/components/admin/RoomCsvUploader";
import { QrExportPanel } from "@/components/admin/QrExportPanel";
import { AddLocationForm } from "@/components/admin/AddLocationForm";
import { AddRoomRangeForm } from "@/components/admin/AddRoomRangeForm";
import { SiteGuestQrArchivedToggle } from "@/components/admin/SiteGuestQrArchivedToggle";
import { RoomAdminListItem, type RoomAdminRow } from "@/components/admin/RoomAdminListItem";

export default async function AdminRoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId } = await searchParams;
  if (!siteId) {
    redirect("/app/admin/sites");
  }
  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id, name, logo_url, archived_at")
    .eq("id", siteId)
    .single();
  if (!site) redirect("/app/admin/sites");
  const siteLogoUrl = (site as { logo_url?: string | null }).logo_url ?? null;
  const siteArchived = (site as { archived_at?: string | null }).archived_at != null;

  const { data: settingsRow } = await supabase
    .from("site_settings")
    .select("allow_guest_qr_for_archived_rooms")
    .eq("site_id", siteId)
    .maybeSingle();

  const { data: roomsRaw } = await supabase
    .from("rooms")
    .select("id, room_label, floor, active, archived_at")
    .eq("site_id", siteId)
    .order("room_label")
    .range(0, 1999);

  const roomIds = (roomsRaw ?? []).map((r) => r.id);
  const { data: tokensRaw } =
    roomIds.length > 0
      ? await supabase
          .from("room_tokens")
          .select("room_id, token_hash, expires_at, revoked_at")
          .in("room_id", roomIds)
          .is("revoked_at", null)
          .range(0, 1999)
      : { data: [] as { room_id: string; token_hash: string; expires_at: string | null; revoked_at: string | null }[] };

  const tokenRowByRoomId = new Map((tokensRaw ?? []).map((t) => [t.room_id, t]));

  const rooms: RoomAdminRow[] = (roomsRaw ?? [])
    .map((r) => {
      const tr = tokenRowByRoomId.get(r.id);
      const qrActive = tr ? isRoomTokenActive(tr) : false;
      const tokenHint = qrActive && tr?.token_hash ? `···${tr.token_hash.slice(-6)}` : null;
      return {
        id: r.id,
        room_label: r.room_label ?? "",
        floor: r.floor ?? null,
        active: r.active ?? true,
        archived_at: (r as { archived_at?: string | null }).archived_at ?? null,
        qr_active: qrActive,
        token_hint: tokenHint,
      };
    })
    .sort((a, b) => naturalCompare(a.room_label ?? "", b.room_label ?? ""));

  const activeRooms = rooms.filter((r) => !r.archived_at);
  const archivedRooms = rooms.filter((r) => !!r.archived_at);
  const roomsForQrExport = activeRooms.map((r) => ({
    id: r.id,
    room_label: r.room_label,
    floor: r.floor,
    active: r.active,
  }));

  return (
    <div className="p-6 max-w-4xl">
      <nav className="flex items-center gap-2 mb-6 flex-wrap" aria-label="Breadcrumb">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/admin/sites">Customers</Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-semibold tracking-tight">{site.name} – Locations & QR</h1>
        {siteArchived && (
          <Badge variant="outline" className="text-amber-800 border-amber-500/50">
            Customer archived
          </Badge>
        )}
      </nav>

      <SiteGuestQrArchivedToggle
        siteId={siteId}
        initialAllow={settingsRow?.allow_guest_qr_for_archived_rooms ?? false}
        hasArchivedRooms={archivedRooms.length > 0}
      />

      <div className="space-y-6">
        {siteArchived ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/20 p-4">
            This customer is archived. You can still review past QR and location labels below. New locations, imports, and
            ticket creation from this customer are disabled. Ticket history remains on the site dashboard.
          </p>
        ) : (
          <>
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Add a location (room or area)</h2>
              <AddLocationForm siteId={siteId} />
            </div>
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">Add rooms by number range</h2>
              <AddRoomRangeForm siteId={siteId} />
              <p className="text-xs text-muted-foreground mt-1">
                Easiest: type <strong>Room 1-Room 120</strong> in Quick add to create Room 1, Room 2, … Room 120 (printed
                QR labels will show the same). Or type <strong>122</strong> or <strong>1-122</strong> and use the Prefix
                field (e.g. &quot;Room &quot;) for labels. Then use Export QR to print by room.
              </p>
            </div>
            <RoomCsvUploader siteId={siteId} />
          </>
        )}
        <QrExportPanel
          siteId={siteId}
          siteName={site.name}
          siteLogoUrl={siteLogoUrl}
          rooms={roomsForQrExport}
          siteArchived={siteArchived}
        />
      </div>

      <div className="mt-8 space-y-6">
        <div>
          <h2 className="text-lg font-medium mb-2">Active locations</h2>
          {activeRooms.length ? (
            <ul className="border rounded-md divide-y">
              {activeRooms.map((r) => (
                <RoomAdminListItem key={r.id} r={r} siteId={siteId} />
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 py-8 px-4 text-center">
              <p className="font-medium text-foreground">No active locations</p>
              <p className="text-sm text-muted-foreground mt-1">
                {siteArchived ? "Customer is archived." : "Add a room above, use the range quick-add, or upload a CSV."}
              </p>
            </div>
          )}
        </div>
        {archivedRooms.length > 0 && (
          <div>
            <h2 className="text-lg font-medium mb-2 text-muted-foreground">Archived locations</h2>
            <ul className="border rounded-md divide-y border-dashed opacity-90">
              {archivedRooms.map((r) => (
                <RoomAdminListItem key={r.id} r={r} siteId={siteId} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
