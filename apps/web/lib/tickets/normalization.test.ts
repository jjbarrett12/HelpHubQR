import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TICKET_EVENT,
  TICKET_EVENT_TYPE_CODES,
  isTicketEventTypeCode,
  ticketStatusTransitionEventType,
} from "./event-types";
import { buildTicketAttachmentRow } from "./attachment-metadata";
import { TICKET_REQUEST_TYPE_CODES, isTicketRequestTypeCode } from "./request-types-catalog";
import { createTicketBodySchema } from "../validators";

test("ticket event type catalog is the canonical 10-code set", () => {
  const expected = new Set([
    "created",
    "assigned",
    "unassigned",
    "status_changed",
    "priority_changed",
    "attachment_added",
    "comment_added",
    "resolved",
    "reopened",
    "cancelled",
  ]);
  assert.equal(TICKET_EVENT_TYPE_CODES.length, expected.size);
  for (const c of TICKET_EVENT_TYPE_CODES) {
    assert.ok(expected.has(c));
    assert.ok(isTicketEventTypeCode(c));
    assert.equal(TICKET_EVENT[c], c);
  }
});

test("ticketStatusTransitionEventType maps terminal and reopen transitions", () => {
  assert.equal(ticketStatusTransitionEventType("new", "resolved"), "resolved");
  assert.equal(ticketStatusTransitionEventType("in_progress", "cancelled"), "cancelled");
  assert.equal(ticketStatusTransitionEventType("resolved", "new"), "reopened");
  assert.equal(ticketStatusTransitionEventType("cancelled", "in_progress"), "reopened");
  assert.equal(ticketStatusTransitionEventType("new", "in_progress"), "status_changed");
});

test("createTicketBodySchema accepts catalog request_type_code and rejects unknown", () => {
  const ok = createTicketBodySchema.safeParse({
    token: "t",
    note: "hello world note",
    request_type_code: "towels",
  });
  assert.ok(ok.success);
  const bad = createTicketBodySchema.safeParse({
    token: "t",
    note: "hello world note",
    request_type_code: "not_a_real_code",
  });
  assert.ok(!bad.success);
});

test("ticket request type codes align with isTicketRequestTypeCode", () => {
  for (const c of TICKET_REQUEST_TYPE_CODES) {
    assert.ok(isTicketRequestTypeCode(c));
  }
  assert.equal(isTicketRequestTypeCode("bogus"), false);
});

test("buildTicketAttachmentRow fills metadata for inserts", () => {
  const row = buildTicketAttachmentRow(
    { ticket_id: "tid", storage_path: "a/b/c.jpg" },
    {
      uploaded_by: "uid",
      original_filename: "photo.jpg",
      mime_type: "image/jpeg",
      file_size_bytes: 12,
      bucket_name: "proof",
      checksum: "sha256:abc",
    }
  );
  assert.deepEqual(row, {
    ticket_id: "tid",
    storage_path: "a/b/c.jpg",
    uploaded_by: "uid",
    original_filename: "photo.jpg",
    mime_type: "image/jpeg",
    file_size_bytes: 12,
    bucket_name: "proof",
    checksum: "sha256:abc",
  });
});
