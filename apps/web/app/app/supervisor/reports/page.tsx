import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { getSupervisorReportData } from "@/lib/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SupervisorReportsPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from("supervisor_profiles")
    .select("property_id")
    .eq("user_id", user.id)
    .single();
  if (!profile?.property_id) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">You are not assigned to a property.</p>
      </div>
    );
  }

  const { byRequestType, summary } = await getSupervisorReportData(profile.property_id as string);

  return (
    <div className="p-6 max-w-4xl">
      <nav className="mb-6 flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app">Dashboard</Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/checklist-runs">Runs</Link>
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      </nav>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-1 text-sm font-medium text-muted-foreground">Tasks (last 30 days)</CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.totalLast30}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 text-sm font-medium text-muted-foreground">Completed (30 days)</CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.completedLast30}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 text-sm font-medium text-muted-foreground">Overdue (open)</CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.overdueOpen}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 text-sm font-medium text-muted-foreground">SLA compliance</CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.slaCompliancePercent}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-medium text-foreground">By request type (last 30 days)</h2>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Last 7 days</th>
                  <th className="pb-2 pr-4 font-medium">Last 30 days</th>
                  <th className="pb-2 pr-4 font-medium">Completed</th>
                  <th className="pb-2 font-medium">Avg resolution (min)</th>
                </tr>
              </thead>
              <tbody>
                {byRequestType.map((row: { request_type_id: string; label: string; code: string; last7: number; last30: number; completed: number; avgResolutionMinutes: number | null }) => (
                  <tr key={row.request_type_id} className="border-b">
                    <td className="py-2 pr-4 font-medium">{row.label}</td>
                    <td className="py-2 pr-4">{row.last7}</td>
                    <td className="py-2 pr-4">{row.last30}</td>
                    <td className="py-2 pr-4">{row.completed}</td>
                    <td className="py-2">{row.avgResolutionMinutes ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
