import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calendarDateInTimeZone, DEFAULT_TIMEZONE } from "@/lib/date";
import { resolveActiveOrganizationId } from "@/lib/helphub/org-context";
import { resolveEmployeeInActiveOrg } from "@/lib/helphub/employee-context";
import {
  EmployeeMyShiftsClient,
  type MyShiftRow,
} from "@/components/helphub/workforce/EmployeeMyShiftsClient";

export default async function MyShiftsPage() {
  const scheduleTz = process.env.CRON_SCHEDULE_TZ?.trim() || DEFAULT_TIMEZONE;
  const today = calendarDateInTimeZone(scheduleTz);

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const orgId = await resolveActiveOrganizationId(supabase, user.id);
  if (!orgId) {
    return (
      <div className="p-6 max-w-lg">
        <h1 className="text-lg font-semibold">My shifts</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select an organization above.</p>
      </div>
    );
  }

  const employeeId = await resolveEmployeeInActiveOrg(supabase, user.id, orgId);
  if (!employeeId) {
    return (
      <div className="p-6 max-w-lg space-y-3">
        <h1 className="text-lg font-semibold">My shifts</h1>
        <p className="text-sm text-muted-foreground">
          Your login is not linked to an employee record. Ask a manager to set your{" "}
          <strong>App login user</strong> on your employee profile, or link your user UUID in the admin
          Employees screen.
        </p>
        <Link href="/app/employees" className="text-sm text-primary underline">
          Go to Employees
        </Link>
      </div>
    );
  }

  const selectShifts = `
    id,
    shift_date,
    shift_type,
    is_open_for_claim,
    locations ( name ),
    staff_roles ( name )
  `;

  const [{ data: myRaw }, { data: openRaw }, { data: coworkerRows }] = await Promise.all([
    supabase
      .from("employee_shifts")
      .select(selectShifts)
      .eq("organization_id", orgId)
      .eq("employee_id", employeeId)
      .gte("shift_date", today)
      .order("shift_date", { ascending: true })
      .limit(40),
    supabase
      .from("employee_shifts")
      .select(selectShifts)
      .eq("organization_id", orgId)
      .eq("is_open_for_claim", true)
      .neq("employee_id", employeeId)
      .gte("shift_date", today)
      .order("shift_date", { ascending: true })
      .limit(40),
    supabase
      .from("employees")
      .select("id, full_name")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .neq("id", employeeId)
      .order("full_name"),
  ]);

  const mapShift = (row: Record<string, unknown>): MyShiftRow => {
    const loc = row.locations as { name: string } | { name: string }[] | null;
    const role = row.staff_roles as { name: string } | { name: string }[] | null;
    const l = Array.isArray(loc) ? loc[0] : loc;
    const r = Array.isArray(role) ? role[0] : role;
    return {
      id: row.id as string,
      shift_date: row.shift_date as string,
      shift_type: row.shift_type as string,
      is_open_for_claim: row.is_open_for_claim as boolean,
      location_name: l?.name ?? null,
      role_name: r?.name ?? "—",
    };
  };

  const myShifts = (myRaw ?? []).map(mapShift);
  const openShifts = (openRaw ?? []).map(mapShift);
  const coworkers = (coworkerRows ?? []).map((c) => ({
    id: c.id as string,
    full_name: c.full_name as string,
  }));

  return (
    <div className="min-h-full">
      <div className="border-b bg-card/40 px-4 py-4">
        <h1 className="text-xl font-semibold">My shifts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Coverage, open shifts, and trade offers.{" "}
          <Link href="/app/my-requests" className="text-primary underline">
            Task &amp; approval status
          </Link>
        </p>
      </div>
      <EmployeeMyShiftsClient myShifts={myShifts} openShifts={openShifts} coworkers={coworkers} />
    </div>
  );
}
