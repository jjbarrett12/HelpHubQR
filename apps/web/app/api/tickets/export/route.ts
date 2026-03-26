import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to = searchParams.get("to"); // YYYY-MM-DD

  if (!siteId) {
    return NextResponse.json({ error: "siteId required" }, { status: 400 });
  }

  // Verify user has access to this site (RLS will filter tickets)
  const { data: site } = await supabase
    .from("sites")
    .select("id, name")
    .eq("id", siteId)
    .single();
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  let query = supabase
    .from("tickets")
    .select(
      "id, room_label_snapshot, request_type_label_snapshot, note, status, priority, created_at, created_via, resolved_at"
    )
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (from) {
    query = query.gte("created_at", `${from}T00:00:00.000Z`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59.999Z`);
  }

  const { data: tickets, error: fetchError } = await query;
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const rows = tickets ?? [];
  const headers = [
    "id",
    "room",
    "request_type",
    "note",
    "status",
    "priority",
    "created_at",
    "resolved_at",
    "created_via",
  ];
  const csvLines = [
    headers.join(","),
    ...rows.map((t) => {
      const row = t as Record<string, unknown>;
      return headers
        .map((h) => {
          const key = h === "request_type" ? "request_type_label_snapshot" : h;
          const v = row[key];
          return escapeCsv(v == null ? null : typeof v === "string" ? v : new Date(v as string).toISOString());
        })
        .join(",");
    }),
  ];
  const csv = csvLines.join("\r\n");

  const fromLabel = from ?? "start";
  const toLabel = to ?? "end";
  const filename = `tickets-${(site as { name: string }).name.replace(/[^a-z0-9-_]/gi, "-")}-${fromLabel}-${toLabel}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
