import type { ManagerRequestDetail, RequestUrgency } from "@/components/manager-requests/mock-data";
import type { RequestFeedItem, RequestFeedUrgency } from "@/lib/helphub/requests/request-feed";
import { labelRequestFeedStatusForManager } from "@/lib/helphub/requests/request-feed-labels";

function mapFeedUrgencyToManager(u: RequestFeedUrgency): RequestUrgency {
  if (u === "high") return "urgent";
  if (u === "normal") return "soon";
  return "normal";
}

function toManagerKind(
  kind: RequestFeedItem["kind"]
): ManagerRequestDetail["kind"] {
  switch (kind) {
    case "task_transfer":
      return "task_transfer";
    case "open_shift_claim":
      return "open_shift_pickup";
    case "swap":
      return "shift_swap";
    case "coverage":
      return "coverage";
    case "schedule_change":
      return "schedule_change";
    default:
      return "coverage";
  }
}

export function mapRequestFeedItemToManagerDetail(row: RequestFeedItem): ManagerRequestDetail {
  const kind = toManagerKind(row.kind);
  const status =
    row.status === "executed"
      ? ("executed" as const)
      : (row.status as ManagerRequestDetail["status"]);
  const urgency = mapFeedUrgencyToManager(row.urgency);
  const requesterName = row.requester.name?.trim() || "Unknown employee";
  const requesterId = row.requester.employee_id;
  const ctx = row.shift_date?.trim() || row.shift?.role || "—";

  const title =
    kind === "task_transfer"
      ? `Task transfer · ${(row.task?.title ?? "").slice(0, 48)}`
      : kind === "open_shift_pickup"
        ? `Open shift pickup · ${ctx}`
        : kind === "shift_swap"
          ? `Shift trade · ${ctx}`
          : `Coverage · ${ctx}`;

  const payloadStr =
    row.action_payload && Object.keys(row.action_payload).length > 0
      ? JSON.stringify(row.action_payload, null, 0)
      : null;
  const fullContext = [
    `Source: ${row.source_table} · id: ${row.id} · source_request_type: ${row.source_request_type ?? "—"}`,
    payloadStr ? `action_payload: ${payloadStr}` : null,
    row.reason ? `Reason: ${row.reason}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const counterName = row.target_employee?.name?.trim();
  const counterId = row.target_employee?.employee_id;

  const affected: ManagerRequestDetail["affectedParties"] = [
    {
      id: "requester",
      role: "Requester",
      name: requesterName,
      note: requesterId ? `employee_id: ${requesterId}` : undefined,
    },
  ];
  if (counterName || counterId) {
    affected.push({
      id: "counterparty",
      role: "Counterparty",
      name: counterName || "Unknown",
      note: counterId ? `employee_id: ${counterId}` : undefined,
    });
  }

  const proposedCounterparty =
    counterName && counterId
      ? {
          name: counterName,
          employeeId: counterId,
          relationship: "Involved in this request",
        }
      : null;

  return {
    id: row.id,
    kind,
    title,
    employeeName: requesterName,
    employeeId: requesterId,
    contextLine: ctx,
    reason: row.reason,
    submittedAt: row.created_at,
    status,
    urgency,
    impactSummary: `${row.source_table} · ${labelRequestFeedStatusForManager(row.status)}`,
    needsManagerAction: row.manager_action_required,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    fullContext,
    affectedParties: affected,
    proposedCounterparty,
    history: [
      {
        id: "feed",
        at: row.updated_at,
        actor: "system",
        summary: `Normalized feed · ${row.urgency} urgency`,
      },
    ],
    fairnessAdvisory: [],
    sourceTableHint: `${row.source_table} · source_id=${row.source_id}`,
    actionPayload: row.action_payload,
  };
}
