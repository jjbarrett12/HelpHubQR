import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTenantInviteAcceptError } from "./invite-errors";

test("formatTenantInviteAcceptError maps known RPC codes", () => {
  assert.match(formatTenantInviteAcceptError("EMAIL_MISMATCH"), /different email/i);
  assert.match(formatTenantInviteAcceptError("INVITE_EXPIRED"), /expired/i);
  assert.match(formatTenantInviteAcceptError("INVITE_NOT_FOUND"), /not valid/i);
  assert.match(formatTenantInviteAcceptError(undefined), /Try again/i);
});
