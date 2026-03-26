import { test } from "node:test";
import assert from "node:assert/strict";
import { safePostLoginPath } from "./safe-post-login-path";

test("safePostLoginPath allows /app and /join", () => {
  assert.equal(safePostLoginPath("/join"), "/join");
  assert.equal(safePostLoginPath("/app/admin/sites"), "/app/admin/sites");
  assert.equal(safePostLoginPath("/platform-admin"), "/platform-admin");
});

test("safePostLoginPath rejects open redirects", () => {
  assert.equal(safePostLoginPath("//evil.com"), "/app/today");
  assert.equal(safePostLoginPath("https://evil.com"), "/app/today");
  assert.equal(safePostLoginPath("/../admin"), "/app/today");
});
