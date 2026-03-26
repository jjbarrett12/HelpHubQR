import { test } from "node:test";
import assert from "node:assert/strict";

function formatRoomsDbError(message) {
  if (!message) return "Could not save this location. Please try again.";
  if (
    message.includes("rooms_site_room_label_lower_uidx") ||
    message.includes("rooms_site_room_label_lower")
  ) {
    return "A location with this name already exists for this site (names are compared case-insensitive).";
  }
  return "Could not save this location. Please try again.";
}

test("formatRoomsDbError maps unique room label violation", () => {
  assert.ok(
    formatRoomsDbError('duplicate key value violates unique constraint "rooms_site_room_label_lower_uidx"').includes(
      "already exists"
    )
  );
});

test("formatRoomsDbError generic fallback", () => {
  assert.ok(formatRoomsDbError("other").includes("Could not save"));
});
