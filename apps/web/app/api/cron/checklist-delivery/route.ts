import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { runChecklistDeliveryCron } from "@/lib/delivery/cron-checklist-delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  if (process.env.CRON_REQUIRE_VERCEL_HEADER === "1") {
    if (request.headers.get("x-vercel-cron") !== "1") return false;
  }
  const h = request.headers.get("x-cron-secret");
  if (h === secret) return true;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice(7).trim() === secret) return true;
  return false;
}

/**
 * POST /api/cron/checklist-delivery
 * Headers: x-cron-secret: <CRON_SECRET> or Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    console.info(
      JSON.stringify({
        event: "checklist_delivery_cron.unauthorized",
        ts: new Date().toISOString(),
      })
    );
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "service_role_unavailable";
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }

  try {
    const summary = await runChecklistDeliveryCron(admin);
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "cron_failed";
    console.error(
      JSON.stringify({
        event: "checklist_delivery_cron.fatal",
        ts: new Date().toISOString(),
        error: msg,
      })
    );
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
