import { test } from "node:test";
import assert from "node:assert/strict";

function isRoomTokenActive(row, now = new Date()) {
  if (row.revoked_at) return false;
  if (row.expires_at && new Date(row.expires_at) <= now) return false;
  return true;
}

function assertAtMostOneActivePerRoom(rows, now = new Date()) {
  const seen = new Map();
  for (const row of rows) {
    if (!isRoomTokenActive(row, now)) continue;
    if (seen.has(row.room_id)) {
      throw new Error(`Multiple active tokens for room ${row.room_id}`);
    }
    seen.set(row.room_id, row);
  }
}

test("isRoomTokenActive respects revoked_at", () => {
  assert.equal(isRoomTokenActive({ revoked_at: "2020-01-01", expires_at: null }), false);
  assert.equal(isRoomTokenActive({ revoked_at: null, expires_at: null }), true);
});

test("isRoomTokenActive respects expires_at", () => {
  const now = new Date("2025-06-15T12:00:00Z");
  assert.equal(
    isRoomTokenActive({ revoked_at: null, expires_at: "2025-06-14T12:00:00Z" }, now),
    false
  );
  assert.equal(
    isRoomTokenActive({ revoked_at: null, expires_at: "2025-06-16T12:00:00Z" }, now),
    true
  );
});

test("assertAtMostOneActivePerRoom passes for history rows", () => {
  const now = new Date("2025-06-15T12:00:00Z");
  assertAtMostOneActivePerRoom(
    [
      { room_id: "r1", revoked_at: "2025-01-01", expires_at: null },
      { room_id: "r1", revoked_at: null, expires_at: "2026-01-01" },
    ],
    now
  );
});

test("assertAtMostOneActivePerRoom throws on duplicate actives", () => {
  const now = new Date("2025-06-15T12:00:00Z");
  assert.throws(() =>
    assertAtMostOneActivePerRoom(
      [
        { room_id: "r1", revoked_at: null, expires_at: null },
        { room_id: "r1", revoked_at: null, expires_at: null },
      ],
      now
    )
  );
});
