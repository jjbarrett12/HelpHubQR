import { Badge } from "@/components/ui/badge";
import { GenerateTokenButton } from "@/components/admin/GenerateTokenButton";
import { RotateRoomQrButton } from "@/components/admin/RotateRoomQrButton";
import { DeleteRoomButton } from "@/components/admin/DeleteRoomButton";

export type RoomAdminRow = {
  id: string;
  room_label: string;
  floor: string | null;
  active: boolean;
  archived_at: string | null;
  qr_active: boolean;
  token_hint: string | null;
};

export function RoomAdminListItem({ r, siteId }: { r: RoomAdminRow; siteId: string }) {
  const isArchived = !!r.archived_at;
  return (
    <li className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
      <span>
        {r.room_label}
        {r.floor ? ` (${r.floor})` : ""}
        {!r.active && !isArchived && " – inactive"}
        {isArchived && (
          <Badge variant="secondary" className="ml-2 text-[10px]">
            Archived
          </Badge>
        )}
      </span>
      <span className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {!isArchived &&
          (r.qr_active ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>QR active {r.token_hint ? <code className="text-[10px]">{r.token_hint}</code> : null}</span>
              <RotateRoomQrButton roomId={r.id} siteId={siteId} />
            </span>
          ) : (
            <GenerateTokenButton roomId={r.id} />
          ))}
        <DeleteRoomButton
          roomId={r.id}
          siteId={siteId}
          roomLabel={r.room_label + (r.floor ? ` (${r.floor})` : "")}
          isArchived={isArchived}
        />
      </span>
    </li>
  );
}
