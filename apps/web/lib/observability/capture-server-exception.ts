import { logServerEvent } from "@/lib/observability/server-log";

/**
 * Structured log plus optional Sentry. To enable Sentry: `npm i @sentry/node` in apps/web,
 * set `SENTRY_DSN`, and add `Sentry.captureException` in this file (or use `@sentry/nextjs`).
 */
export async function captureServerException(
  err: unknown,
  context: { tags?: Record<string, string>; extra?: Record<string, unknown> }
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  logServerEvent("exception", {
    error_message: message,
    ...context.tags,
    ...context.extra,
  });
}
