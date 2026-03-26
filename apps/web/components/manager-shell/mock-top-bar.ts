/**
 * Typed mock data for the manager top bar until Supabase / realtime hooks land.
 * Replace with: unread alerts query, pending approvals count, SLA breaches, etc.
 */
export type ManagerAlertPreview = {
  id: string;
  severity: "info" | "attention" | "urgent";
  title: string;
  /** ISO timestamp for display */
  at: string;
};

export const mockTopBarAlerts: ManagerAlertPreview[] = [
  {
    id: "1",
    severity: "attention",
    title: "2 open shift claims awaiting review",
    at: new Date().toISOString(),
  },
  {
    id: "2",
    severity: "info",
    title: "Fairness lookback window ends tonight",
    at: new Date().toISOString(),
  },
];

export function mockAlertSummary(alerts: ManagerAlertPreview[]) {
  const urgent = alerts.filter((a) => a.severity === "urgent").length;
  const attention = alerts.filter((a) => a.severity === "attention").length;
  return { urgent, attention, total: alerts.length };
}
