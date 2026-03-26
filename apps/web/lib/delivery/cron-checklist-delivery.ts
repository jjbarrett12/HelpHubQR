import type { SupabaseClient } from "@supabase/supabase-js";
import { fromZonedTime } from "date-fns-tz";
import { calendarDateInTimeZone, DEFAULT_TIMEZONE } from "@/lib/date";
import type { ShiftType } from "@/lib/helphub/types";
import {
  deliverChecklistRunNotifications,
  ensureRunForShift,
  fetchOrCreateDeliverySettings,
} from "./checklist-delivery";

function earliestSendInstantMs(params: {
  shiftDate: string;
  startsAt: string | null;
  offsetMinutes: number;
  scheduleTz: string;
}): number {
  const offsetMs = params.offsetMinutes * 60_000;
  if (params.startsAt) {
    return new Date(params.startsAt).getTime() + offsetMs;
  }
  const dayStart = fromZonedTime(`${params.shiftDate}T00:00:00`, params.scheduleTz);
  return dayStart.getTime() + offsetMs;
}

function logCron(event: string, payload: Record<string, unknown>) {
  console.info(
    JSON.stringify({
      event: `checklist_delivery_cron.${event}`,
      ts: new Date().toISOString(),
      ...payload,
    })
  );
}

export type CronRunSummary = {
  scheduleTz: string;
  calendarDate: string;
  shiftsConsidered: number;
  shiftsSkippedNotYetDue: number;
  shiftsSkippedNoRun: number;
  runsAttempted: number;
  channelOutcomes: Record<string, number>;
  errors: string[];
};

/**
 * Finds today's scheduled shifts (in CRON_SCHEDULE_TZ), ensures a checklist run per shift,
 * then sends SMS/email per org settings (idempotent for cron unless prior success).
 */
export async function runChecklistDeliveryCron(admin: SupabaseClient): Promise<CronRunSummary> {
  const scheduleTz = process.env.CRON_SCHEDULE_TZ?.trim() || DEFAULT_TIMEZONE;
  const today = calendarDateInTimeZone(scheduleTz);
  const nowMs = Date.now();

  const summary: CronRunSummary = {
    scheduleTz,
    calendarDate: today,
    shiftsConsidered: 0,
    shiftsSkippedNotYetDue: 0,
    shiftsSkippedNoRun: 0,
    runsAttempted: 0,
    channelOutcomes: {},
    errors: [],
  };

  const bump = (key: string) => {
    summary.channelOutcomes[key] = (summary.channelOutcomes[key] ?? 0) + 1;
  };

  const { data: shifts, error } = await admin
    .from("employee_shifts")
    .select(
      "id, organization_id, location_id, staff_role_id, shift_type, shift_date, starts_at, status, employee_id"
    )
    .eq("shift_date", today)
    .eq("status", "scheduled");

  if (error) {
    summary.errors.push(error.message);
    logCron("query_failed", { message: error.message });
    return summary;
  }

  const list = shifts ?? [];
  summary.shiftsConsidered = list.length;
  logCron("start", { today, shiftCount: list.length });

  const settingsCache = new Map<string, Awaited<ReturnType<typeof fetchOrCreateDeliverySettings>>>();

  for (const raw of list) {
    const shift = raw as {
      id: string;
      organization_id: string;
      location_id: string | null;
      staff_role_id: string;
      shift_type: ShiftType;
      shift_date: string;
      starts_at: string | null;
      employee_id: string;
    };

    let settings = settingsCache.get(shift.organization_id);
    if (!settings) {
      try {
        settings = await fetchOrCreateDeliverySettings(admin, shift.organization_id);
        settingsCache.set(shift.organization_id, settings);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "delivery_settings_failed";
        summary.errors.push(`${shift.id}: ${msg}`);
        logCron("settings_error", { shiftId: shift.id, organizationId: shift.organization_id, msg });
        continue;
      }
    }

    const earliest = earliestSendInstantMs({
      shiftDate: shift.shift_date,
      startsAt: shift.starts_at,
      offsetMinutes: settings.default_send_offset_minutes,
      scheduleTz,
    });

    if (nowMs < earliest) {
      summary.shiftsSkippedNotYetDue += 1;
      continue;
    }

    const run = await ensureRunForShift(admin, shift);
    if (!run) {
      summary.shiftsSkippedNoRun += 1;
      logCron("no_run", { shiftId: shift.id, organizationId: shift.organization_id });
      continue;
    }

    summary.runsAttempted += 1;
    try {
      const { results } = await deliverChecklistRunNotifications(
        admin,
        shift.organization_id,
        run.runId,
        { resend: false, deliveryTrigger: "cron" }
      );
      for (const r of results) {
        bump(`${r.channel}:${r.outcome}`);
      }
      logCron("run_processed", {
        shiftId: shift.id,
        runId: run.runId,
        organizationId: shift.organization_id,
        results,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "delivery_failed";
      summary.errors.push(`${run.runId}: ${msg}`);
      logCron("run_error", { shiftId: shift.id, runId: run.runId, msg });
    }
  }

  logCron("complete", summary);
  return summary;
}
