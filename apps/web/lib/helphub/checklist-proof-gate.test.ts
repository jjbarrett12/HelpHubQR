import { test } from "node:test";
import assert from "node:assert/strict";
import { proofGateErrorToHttp } from "./checklist-proof-gate";

test("proofGateErrorToHttp maps gate codes to HTTP", () => {
  assert.equal(proofGateErrorToHttp("NOT_AUTHENTICATED").status, 401);
  assert.equal(proofGateErrorToHttp("NOT_ORG_MEMBER").status, 403);
  assert.equal(proofGateErrorToHttp("RUN_ITEM_NOT_FOUND").status, 404);
  assert.equal(proofGateErrorToHttp("RUN_CLOSED").status, 409);
  assert.equal(proofGateErrorToHttp("ITEM_SUPPRESSED").status, 409);
  assert.equal(proofGateErrorToHttp("NOT_ASSIGNED").status, 403);
  assert.equal(proofGateErrorToHttp("ASSIGNMENT_DECLINED").status, 409);
  assert.equal(proofGateErrorToHttp("OVERRIDE_SUPPRESSED").status, 409);
});
