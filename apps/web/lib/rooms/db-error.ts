/** Map Postgres unique violations on rooms to readable copy. */

export function formatRoomsDbError(message: string | null | undefined): string {
  if (!message) return "Could not save this location. Please try again.";
  if (
    message.includes("rooms_site_room_label_lower_uidx") ||
    message.includes("rooms_site_room_label_lower")
  ) {
    return "A location with this name already exists for this site (names are compared case-insensitive).";
  }
  return "Could not save this location. Please try again.";
}
