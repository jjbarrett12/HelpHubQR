/**
 * Prevents open redirects after sign-in. Only same-origin relative paths under /app, /join, or /platform-admin.
 */
export function safePostLoginPath(raw: string | null | undefined): string {
  const fallback = "/app/today";
  if (!raw || typeof raw !== "string") return fallback;
  const path = raw.trim().split(/[?#]/, 1)[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (path.includes("..")) return fallback;
  const allowed =
    path === "/join" || path.startsWith("/join/") || path === "/app" || path.startsWith("/app/") || path.startsWith("/platform-admin");
  return allowed ? path : fallback;
}
