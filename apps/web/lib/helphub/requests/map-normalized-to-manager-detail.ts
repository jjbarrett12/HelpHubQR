import type { ManagerRequestDetail } from "@/components/manager-requests/mock-data";
import type { NormalizedWorkforceRequestRow } from "@/lib/helphub/requests/normalized-workforce-request";

function asRequestKind(kind: string): ManagerRequestDetail["kind"] {
  if (kind === "coverage_direct_trade") return "coverage";
  if (
    kind === "shift_swap" ||
    kind === "coverage" ||
    kind === "open_shift_pickup" ||
    kind === "task_transfer" ||
    kind === "schedule_change" ||
    kind === "availability_change"
  ) {
    return kind;
  }
  return "coverage";
}

function asProductStatus(s: string): ManagerRequestDetail["status"] {
  if (
    s === "pending_manager" ||
    s === "pending_peer" ||
    s === "pending_employee" ||
    s === "approved" ||
    s === "executed" ||
    s === "denied" ||
    s === "cancelled" ||
    s === "expired"
  ) {
    return s;
  }
  return "pending_peer";
}

function asUrgency(u: string): ManagerRequestDetail["urgency"] {
  if (u === "urgent" || u === "soon" || u === "normal") return u;
  return "normal";
}

function reasonFromDetail(detail: Record<string, unknown>): string | null {
  const r = detail.reason;
  return typeof r === "string" && r.trim() ? r : null;
}

/**
 * Maps one normalized DB row → manager inbox shape. Preserves provenance in `sourceTableHint` and body copy.
 */
export function mapNormalizedRowToManagerDetail(row: NormalizedWorkforceRequestRow): ManagerRequestDetail {
  const kind = asRequestKind(row.kind);
  const status = asProductStatus(row.product_status);
  const urgency = asUrgency(row.urgency);
  const reason = reasonFromDetail(row.source_detail as Record<string, unknown>);
  const requesterName = row.requester_display_name?.trim() || "Unknown employee";
  const requesterId = row.requester_employee_id ?? "";
  const ctx = row.context_summary?.trim() || "—";

  const title =
    kind === "task_transfer"
      ? `Task transfer · ${ctx.slice(0, 48)}${ctx.length > 48 ? "…" : ""}`
      : kind === "open_shift_pickup"
        ? `Open shift pickup · ${ctx}`
        : kind === "shift_swap"
          ? `Shift trade · ${ctx}`
          : row.kind === "coverage_direct_trade"
            ? `Coverage (direct trade) · ${ctx}`
            : `Coverage · ${ctx}`;

  const fullContext = [
    `Source: ${row.raw_table} · raw status: ${row.raw_status} · feed id: ${row.id}`,
    row.context_summary ?? "",
    reason ? `Reason: ${reason}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const counterName = row.counterparty_display_name?.trim();
  const counterId = row.counterparty_employee_id;

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

  const fairness =
    row.fairness_advisory != null &&
    typeof row.fairness_advisory === "object" &&
    Array.isArray(row.fairness_advisory)
      ? (row.fairness_advisory as unknown[]).map((x) => String(x))
      : [];

  return {
    id: row.id,
    kind,
    title,
    employeeName: requesterName,
    employeeId: requesterId,
    contextLine: ctx,
    reason,
    submittedAt: row.submitted_at,
    status,
    urgency,
    impactSummary: `See ${row.raw_table} (${row.raw_status})`,
    needsManagerAction: row.manager_action_required,
    sourceTable: row.raw_table,
    sourceId: row.source_id,
    fullContext,
    affectedParties: affected,
    proposedCounterparty,
    history: [
      {
        id: "raw",
        at: row.updated_at,
        actor: "system",
        summary: `Last update on ${row.raw_table} · product status: ${row.product_status}`,
      },
    ],
    fairnessAdvisory: fairness,
    sourceTableHint: `${row.raw_table} · source_id=${row.source_id}`,
    actionPayload: {},
  };
}
