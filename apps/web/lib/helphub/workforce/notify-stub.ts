/**
 * Hooks for future SMS/email (reuse checklist delivery stack).
 * Call from workforce server actions after state changes.
 */

export async function notifyTaskOfferAvailable(_payload: { organizationId: string; requestId: string }): Promise<void> {
  /* TODO: enqueue delivery to target employee */
}

export async function notifyShiftOpenForClaim(_payload: { organizationId: string; shiftId: string }): Promise<void> {
  /* TODO */
}

export async function notifyShiftTradeProposed(_payload: { organizationId: string; tradeId: string }): Promise<void> {
  /* TODO */
}

export async function notifyWorkforceApprovalResult(_payload: {
  organizationId: string;
  kind: "task_transfer" | "shift_claim" | "shift_trade";
  requestId: string;
  approved: boolean;
}): Promise<void> {
  /* TODO */
}
