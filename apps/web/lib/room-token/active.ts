export type RoomTokenActiveFields = {
  revoked_at: string | null;
  expires_at: string | null;
};

export function isRoomTokenActive(row: RoomTokenActiveFields, now: Date = new Date()): boolean {
  if (row.revoked_at) return false;
  if (row.expires_at && new Date(row.expires_at) <= now) return false;
  return true;
}

/** At most one active row per room_id (for assertions / tests). */
export function assertAtMostOneActivePerRoom<T extends { room_id: string } & RoomTokenActiveFields>(
  rows: T[],
  now: Date = new Date()
): void {
  const seen = new Map<string, T>();
  for (const row of rows) {
    if (!isRoomTokenActive(row, now)) continue;
    const prev = seen.get(row.room_id);
    if (prev) {
      throw new Error(`Multiple active tokens for room ${row.room_id}`);
    }
    seen.set(row.room_id, row);
  }
}
