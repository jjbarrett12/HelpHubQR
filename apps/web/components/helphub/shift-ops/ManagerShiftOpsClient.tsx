"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { publicChecklistUrl } from "@/lib/helphub/app-url";
import type { OrgWorkforceSettings } from "@/lib/helphub/workforce/settings";
import {
  getBestTaskKeySuggestion,
  getTaskKeyDisplayLabel,
  type TaxonomyRow,
} from "@/lib/helphub/task-taxonomy";
import {
  ShiftBriefingNotesPanel,
  type ShiftBriefingNoteRow,
} from "@/components/helphub/shift-ops/ShiftBriefingNotesPanel";
import {
  addRunOverrideTask,
  approveShiftCoverageRequest,
  approveShiftTrade,
  approveTaskTransferRequest,
  denyShiftCoverageRequest,
  denyShiftTrade,
  denyTaskTransferRequest,
  reassignOverrideTask,
  reassignRunTask,
  restoreOverrideTask,
  restoreSuppressedRunTask,
  rewordRunTask,
  setShiftOpenForClaim,
  suppressOverrideTask,
  suppressRunTask,
  updateWorkforceSettings,
} from "@/app/app/helphub/actions/workforce-manager";

export type ShiftOpsRunItem = {
  id: string;
  task_text_snapshot: string | null;
  task_key_snapshot: string | null;
  completed: boolean;
  assigned_employee_id: string | null;
  suppressed: boolean;
  assignment_status: string;
  override_source: string;
};

export type ShiftOpsOverride = {
  id: string;
  task_text_snapshot: string;
  task_key_snapshot?: string | null;
  assigned_employee_id: string | null;
  /** active | suppressed | completed */
  status: string;
};

export type ShiftOpsShiftRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  shift_type: string;
  location_name: string | null;
  role_name: string;
  is_open_for_claim: boolean;
  run: { id: string; access_token: string; status: string } | null;
  items: ShiftOpsRunItem[];
  overrides: ShiftOpsOverride[];
  /** Manager-authored shift briefing rows (see `shift_notes` table). */
  briefingNotes?: ShiftBriefingNoteRow[];
};

export type ShiftOpsPendingTransfer = {
  id: string;
  run_id: string;
  status: string;
  request_mode: string;
  task_preview: string;
  from_name: string;
  to_name: string | null;
  manager_approval_required: boolean;
};

export type ShiftOpsPendingCoverage = {
  id: string;
  employee_shift_id: string;
  status: string;
  request_type: string;
  reason: string | null;
  requested_by_name: string;
  claimed_by_name: string | null;
  manager_approval_required: boolean;
};

export type ShiftOpsPendingTrade = {
  id: string;
  status: string;
  reason: string | null;
  offering_name: string;
  target_name: string | null;
  accepted_by_name: string | null;
  manager_approval_required: boolean;
};

export type ShiftOpsEvent = {
  id: string;
  event_type: string;
  created_at: string;
  payload: Record<string, unknown>;
};

type Props = {
  workforceSettings: OrgWorkforceSettings;
  shifts: ShiftOpsShiftRow[];
  employees: { id: string; full_name: string }[];
  pendingTransfers: ShiftOpsPendingTransfer[];
  pendingCoverage: ShiftOpsPendingCoverage[];
  pendingTrades: ShiftOpsPendingTrade[];
  recentEvents: ShiftOpsEvent[];
  fairnessHints?: Record<string, string[]>;
  /** Resolved display labels for taxonomy-backed task keys (run item id or `override:${id}`). */
  taskKeyLabels?: Record<string, string>;
  /** Active taxonomy rows for override task key picker (optional). */
  overrideTaxonomy?: TaxonomyRow[];
};

function employeeNameById(
  employees: { id: string; full_name: string }[],
  id: string | null
): string {
  if (!id) return "—";
  return employees.find((e) => e.id === id)?.full_name ?? id.slice(0, 8);
}

function overrideStatusLabel(status: string): string {
  if (status === "active") return "Active";
  if (status === "suppressed") return "Suppressed";
  if (status === "completed") return "Completed";
  return status;
}

function OverrideTasksSection({
  overrides,
  employees,
  fairnessHints,
  taskKeyLabels,
  pending,
  runAction,
}: {
  overrides: ShiftOpsOverride[];
  employees: { id: string; full_name: string }[];
  fairnessHints: Record<string, string[]>;
  taskKeyLabels: Record<string, string>;
  pending: boolean;
  runAction: (fn: () => Promise<{ error?: string; ok?: boolean }>) => void;
}) {
  const active = overrides.filter((o) => o.status === "active");
  const inactive = overrides.filter((o) => o.status !== "active");

  return (
    <div className="space-y-4">
      {active.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">One-off tasks (active)</p>
          <ul className="space-y-3">
            {active.map((o) => (
              <li key={o.id} className="border rounded-md p-3 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="inline-block text-[10px] font-medium uppercase tracking-wide text-muted-foreground border border-border/80 rounded px-1.5 py-0.5 mr-2">
                      {overrideStatusLabel(o.status)}
                    </span>
                    <span className="text-sm">{o.task_text_snapshot}</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Assigned: {employeeNameById(employees, o.assigned_employee_id)}
                      {o.assigned_employee_id ? "" : " (shift owner pool)"}
                    </p>
                    {taskKeyLabels[`override:${o.id}`] ? (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Category: {taskKeyLabels[`override:${o.id}`]}
                      </p>
                    ) : null}
                    {(fairnessHints[`override:${o.id}`] ?? []).length > 0 ? (
                      <ul className="text-[11px] text-amber-700 dark:text-amber-400/90 list-disc pl-4 mt-1 space-y-0.5">
                        {(fairnessHints[`override:${o.id}`] ?? []).map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => runAction(async () => suppressOverrideTask(o.id))}
                  >
                    Suppress
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-border/40">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-muted-foreground">Reassign to</span>
                    <select
                      className="border rounded-md px-2 py-1.5 bg-background text-sm min-w-[180px] h-9"
                      id={`reassign-override-${o.id}`}
                      defaultValue={o.assigned_employee_id ?? ""}
                    >
                      <option value="">Shift owner (unassigned)</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      const sel = document.getElementById(
                        `reassign-override-${o.id}`
                      ) as HTMLSelectElement | null;
                      const v = sel?.value ?? "";
                      runAction(async () =>
                        reassignOverrideTask(o.id, v.length > 0 ? v : null)
                      );
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {inactive.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            One-off tasks (suppressed or completed)
          </p>
          <ul className="space-y-2">
            {inactive.map((o) => (
              <li
                key={o.id}
                className={`border rounded-md p-2 flex flex-wrap gap-2 justify-between ${
                  o.status === "suppressed" ? "opacity-90" : "opacity-75"
                }`}
              >
                <div className="min-w-0">
                  <span className="inline-block text-[10px] font-medium uppercase tracking-wide text-muted-foreground border border-border/80 rounded px-1.5 py-0.5 mr-2">
                    {overrideStatusLabel(o.status)}
                  </span>
                  <span className="text-sm">{o.task_text_snapshot}</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Was: {employeeNameById(employees, o.assigned_employee_id)}
                    {o.assigned_employee_id ? "" : " shift owner pool"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {o.status === "suppressed" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => runAction(async () => restoreOverrideTask(o.id))}
                    >
                      Restore
                    </Button>
                  ) : null}
                  {o.status === "completed" ? (
                    <span className="text-[10px] text-muted-foreground max-w-[12rem] text-right">
                      No manager actions — finished on the checklist.
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ManagerShiftOpsClient({
  workforceSettings: initialSettings,
  shifts,
  employees,
  pendingTransfers,
  pendingCoverage,
  pendingTrades,
  recentEvents,
  fairnessHints = {},
  taskKeyLabels = {},
  overrideTaxonomy = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const runAction = (fn: () => Promise<{ error?: string; ok?: boolean }>) => {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res && res.error) setMsg(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-6xl mx-auto">
      {msg ? (
        <p className="text-sm text-destructive border border-destructive/40 rounded-md px-3 py-2">{msg}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workforce settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-2 text-sm"
            action={(fd) => {
              setMsg(null);
              startTransition(async () => {
                const res = await updateWorkforceSettings(fd);
                if ("error" in res && res.error) setMsg(res.error);
                else router.refresh();
              });
            }}
          >
            {(
              [
                ["allow_employee_task_offers", "Employees can offer tasks"],
                ["allow_open_shift_claims", "Open shift claims"],
                ["allow_shift_trades", "Shift trades"],
                ["manager_approval_required_for_task_transfer", "Manager approves task transfers"],
                ["manager_approval_required_for_shift_claim", "Manager approves shift claims"],
                ["manager_approval_required_for_shift_trade", "Manager approves trades"],
                ["allow_cross_role_claims", "Allow cross-role claims"],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name={name}
                  defaultChecked={initialSettings[name as keyof OrgWorkforceSettings] as boolean}
                  className="rounded border-input"
                />
                {label}
              </label>
            ))}
            <div className="sm:col-span-2 pt-2">
              <Button type="submit" size="sm" disabled={pending}>
                Save settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Pending task transfers
        </h2>
        {pendingTransfers.length === 0 ? (
          <p className="text-sm text-muted-foreground">None for this day.</p>
        ) : (
          <ul className="space-y-2">
            {pendingTransfers.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-2 border rounded-md p-3 text-sm bg-card"
              >
                <span className="font-medium">{t.task_preview}</span>
                <span className="text-muted-foreground">
                  {t.from_name} → {t.to_name ?? "Open offer"} · {t.status}
                </span>
                {t.status === "accepted" && t.manager_approval_required ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        runAction(async () => approveTaskTransferRequest(t.id))
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        runAction(async () => denyTaskTransferRequest(t.id))
                      }
                    >
                      Deny
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Shift coverage
        </h2>
        {pendingCoverage.length === 0 ? (
          <p className="text-sm text-muted-foreground">None for this day.</p>
        ) : (
          <ul className="space-y-2">
            {pendingCoverage.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 border rounded-md p-3 text-sm bg-card"
              >
                <span>
                  {c.requested_by_name}
                  {c.claimed_by_name ? ` → ${c.claimed_by_name}` : ""} · {c.status}
                </span>
                <span className="text-muted-foreground">{c.request_type}</span>
                {(c.status === "pending" || c.status === "claimed") &&
                c.manager_approval_required ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        runAction(async () => approveShiftCoverageRequest(c.id))
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        runAction(async () => denyShiftCoverageRequest(c.id))
                      }
                    >
                      Deny
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Shift trades
        </h2>
        {pendingTrades.length === 0 ? (
          <p className="text-sm text-muted-foreground">None for this day.</p>
        ) : (
          <ul className="space-y-2">
            {pendingTrades.map((tr) => (
              <li
                key={tr.id}
                className="flex flex-wrap items-center gap-2 border rounded-md p-3 text-sm bg-card"
              >
                <span>
                  {tr.offering_name}
                  {tr.target_name ? ` → ${tr.target_name}` : " (open)"} · {tr.status}
                </span>
                {tr.accepted_by_name ? (
                  <span className="text-muted-foreground">Accepted by {tr.accepted_by_name}</span>
                ) : null}
                {tr.status === "accepted" && tr.manager_approval_required ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => runAction(async () => approveShiftTrade(tr.id))}
                    >
                      Approve trade
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => runAction(async () => denyShiftTrade(tr.id))}
                    >
                      Deny
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Roster & tasks
        </h2>
        <div className="space-y-6">
          {shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shifts match these filters.</p>
          ) : (
            shifts.map((s) => (
              <Card key={s.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {s.employee_name}{" "}
                      <span className="text-muted-foreground font-normal">
                        · {s.shift_type} · {s.role_name}
                        {s.location_name ? ` · ${s.location_name}` : ""}
                      </span>
                    </CardTitle>
                    {(fairnessHints[`shift:${s.id}`] ?? []).length > 0 ? (
                      <ul className="text-[11px] text-amber-700 dark:text-amber-400/90 w-full list-disc pl-4 space-y-0.5">
                        {(fairnessHints[`shift:${s.id}`] ?? []).map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {s.run?.access_token ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={publicChecklistUrl(s.run.access_token)} target="_blank">
                            Open checklist
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant={s.is_open_for_claim ? "secondary" : "outline"}
                        disabled={pending}
                        onClick={() =>
                          runAction(async () => setShiftOpenForClaim(s.id, !s.is_open_for_claim))
                        }
                      >
                        {s.is_open_for_claim ? "Close open claim" : "Mark open for claim"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <ShiftBriefingNotesPanel
                    shiftId={s.id}
                    notes={s.briefingNotes ?? []}
                    disabled={pending}
                    onRefresh={() => router.refresh()}
                  />
                  {s.run ? (
                    <AddOverrideForm
                      runId={s.run.id}
                      employees={employees}
                      disabled={pending}
                      onDone={() => router.refresh()}
                      setMsg={setMsg}
                      taxonomy={overrideTaxonomy}
                    />
                  ) : (
                    <p className="text-muted-foreground">No checklist run yet for this shift.</p>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      Template tasks (tonight)
                    </p>
                    <ul className="space-y-2">
                      {s.items.map((it) => (
                        <li
                          key={it.id}
                          className={`border rounded-md p-2 space-y-2 ${
                            it.suppressed ? "opacity-60 bg-muted/40" : ""
                          }`}
                        >
                          <div className="flex flex-wrap gap-2 justify-between">
                            <span>
                              {it.completed ? "✓ " : ""}
                              {it.task_text_snapshot ?? "(no text)"}
                              {it.suppressed ? (
                                <span className="ml-2 text-xs text-amber-600">Suppressed</span>
                              ) : null}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {it.override_source !== "template" ? ` · ${it.override_source}` : ""}
                              </span>
                              {taskKeyLabels[it.id] ? (
                                <span className="ml-2 block text-[11px] text-muted-foreground">
                                  Category: {taskKeyLabels[it.id]}
                                </span>
                              ) : null}
                            </span>
                          </div>
                          {(fairnessHints[it.id] ?? []).length > 0 ? (
                            <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
                              {(fairnessHints[it.id] ?? []).map((h) => (
                                <li key={h}>{h}</li>
                              ))}
                            </ul>
                          ) : null}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span>
                              Assigned: {employeeNameById(employees, it.assigned_employee_id)} ·{" "}
                              {it.assignment_status}
                            </span>
                          </div>
                          {!it.completed && !it.suppressed ? (
                            <div className="flex flex-wrap gap-2 items-end">
                              <label className="flex flex-col gap-1">
                                <span className="text-[11px] text-muted-foreground">Reassign</span>
                                <select
                                  className="border rounded-md px-2 py-1 bg-background text-sm min-w-[140px]"
                                  id={`reassign-${it.id}`}
                                >
                                  {employees.map((e) => (
                                    <option key={e.id} value={e.id}>
                                      {e.full_name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <Button
                                type="button"
                                size="sm"
                                disabled={pending}
                                onClick={() => {
                                  const sel = document.getElementById(
                                    `reassign-${it.id}`
                                  ) as HTMLSelectElement;
                                  runAction(async () =>
                                    reassignRunTask(it.id, sel?.value ?? "")
                                  );
                                }}
                              >
                                Apply
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() => {
                                  const reason = window.prompt("Reason (optional)") ?? "";
                                  runAction(async () => suppressRunTask(it.id, reason || undefined));
                                }}
                              >
                                Suppress
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={pending}
                                onClick={() => {
                                  const t = window.prompt("New task text for tonight");
                                  if (t) runAction(async () => rewordRunTask(it.id, t));
                                }}
                              >
                                Reword
                              </Button>
                            </div>
                          ) : null}
                          {it.suppressed ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() => runAction(async () => restoreSuppressedRunTask(it.id))}
                            >
                              Restore
                            </Button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {s.overrides.length > 0 ? (
                    <OverrideTasksSection
                      overrides={s.overrides}
                      employees={employees}
                      fairnessHints={fairnessHints}
                      taskKeyLabels={taskKeyLabels}
                      pending={pending}
                      runAction={runAction}
                    />
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Recent workforce events
        </h2>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <ul className="text-xs font-mono space-y-1 border rounded-md p-3 max-h-64 overflow-auto bg-muted/30">
            {recentEvents.map((e) => (
              <li key={e.id}>
                {e.created_at} · {e.event_type}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AddOverrideForm({
  runId,
  employees,
  disabled,
  onDone,
  setMsg,
  taxonomy = [],
}: {
  runId: string;
  employees: { id: string; full_name: string }[];
  disabled: boolean;
  onDone: () => void;
  setMsg: (s: string | null) => void;
  taxonomy?: TaxonomyRow[];
}) {
  const [text, setText] = useState("");
  const [taskKey, setTaskKey] = useState("");
  const [assignee, setAssignee] = useState("");
  const [pending, startTransition] = useTransition();
  const activeTax = taxonomy.filter((t) => t.is_active !== false);
  const suggest = text.trim() ? getBestTaskKeySuggestion(text, activeTax) : "";
  const hintLabel = taskKey.trim() ? getTaskKeyDisplayLabel(taskKey.trim(), taxonomy) : "";
  const selectValue = useMemo(() => {
    if (!taskKey.trim()) return "__auto__";
    if (activeTax.some((t) => t.task_key === taskKey)) return taskKey;
    return "__custom__";
  }, [taskKey, activeTax]);

  return (
    <form
      className="flex flex-wrap gap-2 items-end border border-dashed rounded-md p-3"
      onSubmit={(ev) => {
        ev.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const res = await addRunOverrideTask({
            runId,
            taskText: text,
            taskKey: taskKey.trim() || null,
            assignedEmployeeId: assignee || null,
          });
          if ("error" in res && res.error) setMsg(res.error);
          else {
            setText("");
            setTaskKey("");
            setAssignee("");
            onDone();
          }
        });
      }}
    >
      <div className="flex flex-col gap-1 min-w-[200px] flex-1">
        <Label className="text-xs">Add one-off task</Label>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Task text for tonight only"
          disabled={disabled || pending}
        />
      </div>
      <div className="flex flex-col gap-1 min-w-[200px] max-w-[260px]">
        <Label className="text-xs">Task key (fairness snapshot)</Label>
        <select
          className="h-10 rounded-md border border-input bg-background px-2 text-xs"
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "__auto__") setTaskKey("");
            else if (v === "__custom__") {
              if (!taskKey.trim() && suggest) setTaskKey(suggest);
            } else setTaskKey(v);
          }}
          disabled={disabled || pending}
        >
          <option value="__auto__">Auto from task text</option>
          {activeTax.map((t) => (
            <option key={t.task_key} value={t.task_key}>
              {t.display_label}
            </option>
          ))}
          <option value="__custom__">Custom key…</option>
        </select>
        {selectValue === "__custom__" ? (
          <Input
            value={taskKey}
            onChange={(e) => setTaskKey(e.target.value)}
            placeholder="e.g. trash_run"
            className="text-xs font-mono h-9"
            disabled={disabled || pending}
          />
        ) : null}
        <p className="text-[10px] text-muted-foreground leading-tight">
          {taskKey.trim() ? (
            <>
              <span className="font-mono">{taskKey.trim()}</span>
              {hintLabel && hintLabel !== taskKey.trim() ? <span> · {hintLabel}</span> : null}
            </>
          ) : suggest ? (
            <>
              Auto uses <span className="font-mono">{suggest}</span>
            </>
          ) : (
            "Type task text for a suggested key."
          )}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Assign (optional)</Label>
        <select
          className="border rounded-md px-2 py-2 bg-background text-sm h-10"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          disabled={disabled || pending}
        >
          <option value="">Shift owner / unassigned</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={disabled || pending || !text.trim()}>
        Add
      </Button>
    </form>
  );
}
