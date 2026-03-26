const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 20;

const hits: Map<string, number[]> = new Map();

function prune(key: string) {
  const now = Date.now();
  const times = hits.get(key) ?? [];
  const recent = times.filter((t) => now - t < WINDOW_MS);
  if (recent.length === 0) hits.delete(key);
  else hits.set(key, recent);
}

export function checkQrIssueRateLimit(key: string): boolean {
  prune(key);
  const times = hits.get(key) ?? [];
  if (times.length >= MAX_PER_WINDOW) return false;
  times.push(Date.now());
  hits.set(key, times);
  return true;
}
