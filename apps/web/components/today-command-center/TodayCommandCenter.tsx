"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WorkingNowCard } from "./WorkingNowCard";
import { NextUpCard } from "./NextUpCard";
import { AttendanceFlagsCard } from "./AttendanceFlagsCard";
import { ChecklistProgressCard } from "./ChecklistProgressCard";
import { OverdueTasksCard } from "./OverdueTasksCard";
import { MissingPhotosCard } from "./MissingPhotosCard";
import { ApprovalsInboxCard } from "./ApprovalsInboxCard";
import { OpenShiftsCard } from "./OpenShiftsCard";
import { IssuesCard } from "./IssuesCard";
import { FairnessAlertsCard } from "./FairnessAlertsCard";
import { RosterTimeline } from "./RosterTimeline";
import { RecentlyCompletedCard } from "./RecentlyCompletedCard";
import { ManagerNotesCard } from "./ManagerNotesCard";
import type { TodayCommandCenterMock } from "./mock-data";
import { OperationalOrgRealtimeRefresh } from "@/components/helphub/OperationalOrgRealtimeRefresh";

export type TodayCommandCenterProps = {
  organizationId: string;
  organizationName: string;
  /** Replace with server-fetched snapshot; keep shape from mock-data.ts */
  data: TodayCommandCenterMock;
  dataSource: "mock" | "live";
  /** When set, normalized approvals RPC failed; card may still show mock approvals. */
  approvalsFeedError?: string;
  /** User can approve/deny from Today (org manager/owner/admin). */
  canManageApprovals: boolean;
  /** False when the manager feed RPC failed — inline approve/deny disabled. */
  approvalsActionsEnabled: boolean;
};

export function TodayCommandCenter({
  organizationId,
  organizationName,
  data,
  dataSource,
  approvalsFeedError,
  canManageApprovals,
  approvalsActionsEnabled,
}: TodayCommandCenterProps) {
  const nowLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());

  return (
    <div className="min-h-full bg-[var(--app-bg)]">
      <header className="border-b border-border/60 bg-card/40 px-4 py-5 backdrop-blur-md md:px-8">
        <div className="mx-auto flex max-w-[1920px] flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="ds-section-title">Command center</p>
            <h1 className="ds-page-title mt-2">{organizationName}</h1>
            <p className="ds-meta mt-2 font-mono">{nowLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dataSource === "mock" ? (
              <Badge variant="warning" className="text-[10px]">
                Mock data — wire Supabase + Realtime
              </Badge>
            ) : (
              <Badge variant="success" className="text-[10px]">
                Live
              </Badge>
            )}
            <Button size="sm" variant="default" className="h-8 text-xs" asChild>
              <Link href="/app/shift-ops">Shift operations</Link>
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
              <Link href="/app/schedule">Schedule</Link>
            </Button>
          </div>
        </div>
        {dataSource === "mock" ? (
          <p className="mx-auto mt-3 max-w-[1920px] text-[11px] text-muted-foreground border border-dashed border-amber-500/40 rounded-md px-3 py-2 bg-amber-500/5">
            {/* TODO: Replace MOCK_TODAY_COMMAND in page.tsx with loadTodayCommandCenterSnapshot(supabase, organizationId). */}
            {/* Operational Realtime: OperationalOrgRealtimeRefresh → router.refresh(); see docs/HELP_OPERATIONAL_REALTIME.md */}
            <span className="font-medium text-foreground/90">Dev mode:</span> Showing typed fixtures. Hook queries for{" "}
            <code className="text-[10px]">employee_shifts</code>, <code className="text-[10px]">shift_checklist_runs</code>
            , <code className="text-[10px]">shift_checklist_run_items</code>, workforce requests, and issues — then merge
            into this layout.
          </p>
        ) : null}
        {approvalsFeedError ? (
          <p className="mx-auto mt-2 max-w-[1920px] text-[11px] text-destructive px-1">
            Approvals feed: {approvalsFeedError} (apply migration{" "}
            <code className="text-[10px]">20260429180000_hh_request_feeds</code>).
          </p>
        ) : null}
      </header>

      <div className="mx-auto max-w-[1920px] space-y-8 p-4 pb-10 md:p-6 md:px-8">
        {/* 3-column command grid */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-5 min-w-0">
            <p className="ds-section-title px-0.5">Staffing</p>
            <WorkingNowCard items={data.workingNow} />
            <NextUpCard items={data.nextUp} />
            <AttendanceFlagsCard items={data.attendanceFlags} />
          </div>
          <div className="space-y-5 min-w-0">
            <p className="ds-section-title px-0.5">Execution</p>
            <ChecklistProgressCard items={data.checklistByShift} />
            <OverdueTasksCard items={data.overdueTasks} />
            <MissingPhotosCard items={data.missingPhotos} />
          </div>
          <div className="space-y-5 min-w-0">
            <p className="ds-section-title px-0.5">Actions & alerts</p>
            <ApprovalsInboxCard
              items={data.approvals}
              canManageApprovals={canManageApprovals}
              approvalsActionsEnabled={approvalsActionsEnabled}
            />
            <OpenShiftsCard items={data.openShifts} />
            <IssuesCard items={data.issues} />
            <FairnessAlertsCard items={data.fairnessAlerts} />
          </div>
        </div>

        {/* Bottom row */}
        <div>
          <p className="ds-section-title px-0.5 mb-4">Continuity</p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <RosterTimeline blocks={data.rosterTimeline} />
            <RecentlyCompletedCard items={data.recentlyCompleted} />
            <ManagerNotesCard notes={data.managerNotes} />
          </div>
        </div>
      </div>

      <OperationalOrgRealtimeRefresh organizationId={organizationId} scope="command-center" />

      {/* hidden org id for future client subscriptions */}
      <span className="sr-only" data-organization-id={organizationId} />
    </div>
  );
}
