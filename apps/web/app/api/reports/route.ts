import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { getSupervisorReportData } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("supervisor_profiles")
    .select("property_id")
    .eq("user_id", user.id)
    .single();
  if (!profile?.property_id) {
    return NextResponse.json({ error: "No property" }, { status: 403 });
  }
  const propertyId = profile.property_id as string;
  const data = await getSupervisorReportData(propertyId);
  return NextResponse.json({ propertyId, ...data });
}
