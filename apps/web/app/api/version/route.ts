import { NextResponse } from "next/server";

/**
 * Use this to confirm the correct app is deployed.
 * Open: https://your-domain.com/api/version
 * If you see {"ok":true,...}, this app is live. If 404, the domain is serving a different project.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "HelpHub public routes are deployed",
    routes: ["/", "/login", "/ping", "/t/[token]", "/q/[qrId]", "/guest/[qrId]"],
  });
}
