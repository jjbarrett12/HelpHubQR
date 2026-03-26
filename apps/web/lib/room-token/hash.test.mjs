import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

/** Mirrors apps/web/lib/room-token/hash.ts for contract tests without a TS loader. */
function hashRoomToken(raw) {
  return crypto.createHash("sha256").update(raw.trim(), "utf8").digest("hex");
}

test("hashRoomToken trims before hashing", () => {
  assert.equal(hashRoomToken("  abcd  "), hashRoomToken("abcd"));
});

test("hashRoomToken is stable for sample input", () => {
  const h = hashRoomToken("legacy-room-token-hex");
  assert.equal(h.length, 64);
  assert.match(h, /^[0-9a-f]+$/);
});
