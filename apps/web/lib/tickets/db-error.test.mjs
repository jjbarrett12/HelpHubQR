import { test } from "node:test";
import assert from "node:assert/strict";

function isKnownTicketIntegrityMessage(message) {
  if (!message) return false;
  return /HH_(TICKET|ROOMS)_/.test(message);
}

const MAP = {
  HH_TICKET_SITE_TENANT_MISMATCH: "site mismatch friendly",
  HH_TICKET_ASSIGNEE_INVALID: "assignee friendly",
};

function formatTicketDbError(message) {
  if (!message) return "Something went wrong. Please try again.";
  for (const [code, friendly] of Object.entries(MAP)) {
    if (message.includes(code)) return friendly;
  }
  return "Could not save changes. Please refresh and try again.";
}

test("isKnownTicketIntegrityMessage detects HH_ codes", () => {
  assert.equal(isKnownTicketIntegrityMessage("x"), false);
  assert.equal(isKnownTicketIntegrityMessage("HH_TICKET_ROOM_SITE_MISMATCH: detail"), true);
});

test("formatTicketDbError maps known codes", () => {
  assert.equal(
    formatTicketDbError('HH_TICKET_SITE_TENANT_MISMATCH: site does not belong'),
    "site mismatch friendly"
  );
  assert.equal(formatTicketDbError("random db error"), "Could not save changes. Please refresh and try again.");
});

function formatTicketInsertError(message, options) {
  const code = options?.code;
  if (
    code === "23505" &&
    message &&
    (message.includes("tickets_tenant_client_request") || message.includes("tickets_tenant_client_request_uidx"))
  ) {
    return "This request was already submitted.";
  }
  return formatTicketDbError(message);
}

test("formatTicketInsertError maps idempotency unique violation", () => {
  assert.equal(
    formatTicketInsertError('duplicate key value violates unique constraint "tickets_tenant_client_request_uidx"', {
      code: "23505",
    }),
    "This request was already submitted."
  );
});
