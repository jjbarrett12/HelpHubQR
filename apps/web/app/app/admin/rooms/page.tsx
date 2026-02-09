import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { naturalCompare } from "@/lib/utils";
import { RoomCsvUploader } from "@/components/admin/RoomCsvUploader";
import { QrExportPanel } from "@/components/admin/QrExportPanel";
import { AddLocationForm } from "@/components/admin/AddLocationForm";
import { AddRoomRangeForm } from "@/components/admin/AddRoomRangeForm";
import { GenerateTokenButton } from "@/components/admin/GenerateTokenButton";
import { DeleteRoomButton } from "@/components/admin/DeleteRoomButton";

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
    .select("id, name, logo_url")
    .eq("id", siteId)
    .single();
  if (!site) redirect("/app/admin/sites");
  const siteLogoUrl = (site as { logo_url?: string | null }).logo_url ?? null;

  const { data: roomsRaw } = await supabase
    .from("rooms")
    .select("id, room_label, floor, active")
    .eq("site_id", siteId)
    .order("room_label")
    .range(0, 1999);

  const roomIds = (roomsRaw ?? []).map((r) => r.id);
  const { data: tokensRaw } =
    roomIds.length > 0
      ? await supabase
          .from("room_tokens")
          .select("room_id, token")
          .in("room_id", roomIds)
          .range(0, 1999)
      : { data: [] as { room_id: string; token: string }[] };

  const tokenByRoomId = new Map(
    (tokensRaw ?? []).map((t) => [t.room_id, t.token])
  );
  const rooms = (roomsRaw ?? [])
    .map((r) => ({
      ...r,
      room_tokens: tokenByRoomId.has(r.id)
        ? [{ token: tokenByRoomId.get(r.id)! }]
        : [],
    }))
    .sort((a, b) => naturalCompare(a.room_label ?? "", b.room_label ?? ""));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3010";

  return (
    <div className="p-6 max-w-4xl">
      <nav className="flex items-center gap-2 mb-6 flex-wrap" aria-label="Breadcrumb">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/admin/sites">Customers</Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-semibold tracking-tight">{site.name} – Locations & QR</h1>
      </nav>

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Add a location (room or area)</h2>
          <AddLocationForm siteId={siteId} />
        </div>
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Add rooms by number range</h2>
          <AddRoomRangeForm siteId={siteId} />
          <p className="text-xs text-muted-foreground mt-1">
            Easiest: type <strong>122</strong> in Quick add and click the button to create rooms 1–122 (or type <strong>1-122</strong>). No CSV needed. Then use Export QR to print by room.
          </p>
        </div>
        <RoomCsvUploader siteId={siteId} />
        <QrExportPanel
          siteId={siteId}
          siteName={site.name}
          siteLogoUrl={siteLogoUrl}
          rooms={rooms ?? []}
          baseUrl={baseUrl}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-medium mb-2">All locations</h2>
        {rooms?.length ? (
          <ul className="border rounded-md divide-y">
            {rooms.map((r) => {
              const token = (r as { room_tokens: { token: string }[] | null }).room_tokens?.[0];
              const url = token ? `${baseUrl}/t/${token.token}` : null;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 px-4 py-2 text-sm"
                >
                  <span>
                    {r.room_label}
                    {r.floor ? ` (${r.floor})` : ""}
                    {!r.active && " – inactive"}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {url ? (
                      <code className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {url}
                      </code>
                    ) : (
                      <GenerateTokenButton roomId={r.id} />
                    )}
                    <DeleteRoomButton
                      roomId={r.id}
                      siteId={siteId}
                      roomLabel={r.room_label + (r.floor ? ` (${r.floor})` : "")}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 py-8 px-4 text-center">
            <p className="font-medium text-foreground">No locations yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add a room above, use the range quick-add, or upload a CSV.</p>
          </div>
        )}
      </div>
    </div>
  );
}
