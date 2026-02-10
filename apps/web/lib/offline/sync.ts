/**
 * Sync engine: on load + online event, send queued events FIFO.
 * Conflict strategy: always append events; server is truth.
 */

import { getAll, remove, type QueuedEvent } from "./queue";

const BASE = typeof window !== "undefined" ? "" : "";

async function sendOne(event: QueuedEvent): Promise<boolean> {
  const url = `${BASE}/api${event.endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event.payload),
  });
  return res.ok;
}

export async function syncQueuedEvents(getAuthHeaders?: () => Record<string, string>): Promise<{ sent: number; failed: number }> {
  const events = await getAll();
  let sent = 0;
  let failed = 0;
  const headers = getAuthHeaders?.() ?? {};
  for (const ev of events) {
    try {
      const ok = await fetch(`${BASE}/api${ev.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(ev.payload),
      }).then((r) => r.ok);
      if (ok) {
        await remove(ev.id);
        sent++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}

export function onOnline(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", callback);
  return () => window.removeEventListener("online", callback);
}
