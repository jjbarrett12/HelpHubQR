import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeStaffInviteSuggested,
  isQrRolloutLikelyComplete,
  isTenantOnboardingComplete,
} from "./onboarding";
import { isArchivedRecord } from "./archive";

test("isTenantOnboardingComplete requires status and completed_at", () => {
  assert.equal(isTenantOnboardingComplete({ status: "completed", completed_at: null }), false);
  assert.equal(isTenantOnboardingComplete({ status: "completed", completed_at: "2025-01-01" }), true);
  assert.equal(isTenantOnboardingComplete({ status: "in_progress", completed_at: "2025-01-01" }), false);
});

test("isQrRolloutLikelyComplete needs sites and rooms", () => {
  assert.equal(isQrRolloutLikelyComplete({ sites_created_count: 0, rooms_created_count: 0 }), false);
  assert.equal(isQrRolloutLikelyComplete({ sites_created_count: 1, rooms_created_count: 0 }), false);
  assert.equal(isQrRolloutLikelyComplete({ sites_created_count: 1, rooms_created_count: 1 }), true);
});

test("activeStaffInviteSuggested heuristic", () => {
  assert.equal(activeStaffInviteSuggested({ sites_created_count: 1 }, 0), true);
  assert.equal(activeStaffInviteSuggested({ sites_created_count: 1 }, 2), false);
  assert.equal(activeStaffInviteSuggested({ sites_created_count: 0 }, 0), false);
});

test("isArchivedRecord", () => {
  assert.equal(isArchivedRecord(null), false);
  assert.equal(isArchivedRecord({}), false);
  assert.equal(isArchivedRecord({ archived_at: null }), false);
  assert.equal(isArchivedRecord({ archived_at: "2025-01-01" }), true);
});
