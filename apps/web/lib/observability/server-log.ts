/**
 * One JSON line per event for log aggregators (Datadog, Cloud Logging, etc.).
 * Correlation: pass organization_id, user_id, and domain ids when available.
 */
export type ServerLogFields = Record<string, unknown>;

export function logServerEvent(event: string, fields: ServerLogFields = {}) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    service: "helphub-web",
    ...fields,
  };
  console.log(JSON.stringify(payload));
}
