/**
 * Barrel re-exports for workforce server actions.
 * Do not add `"use server"` here — Next.js only allows direct async exports in those files.
 * Actions are defined with `"use server"` in `./workforce-manager` and `./workforce-employee`.
 */

export {
  updateWorkforceSettings,
  reassignRunTask,
  reassignOverrideTask,
  suppressRunTask,
  restoreSuppressedRunTask,
  rewordRunTask,
  addRunOverrideTask,
  suppressOverrideTask,
  restoreOverrideTask,
  approveTaskTransferRequest,
  denyTaskTransferRequest,
  setShiftOpenForClaim,
  approveShiftCoverageRequest,
  denyShiftCoverageRequest,
  approveShiftTrade,
  denyShiftTrade,
  approveRequestFromFeed,
  denyRequestFromFeed,
} from "./workforce-manager";

export {
  createTaskTransferRequest,
  acceptTaskTransferRequest,
  requestShiftCoverage,
  claimOpenShift,
  claimCoverageRequest,
  proposeShiftTrade,
  acceptShiftTrade,
} from "./workforce-employee";
