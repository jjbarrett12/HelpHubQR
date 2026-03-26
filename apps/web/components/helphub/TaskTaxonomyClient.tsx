"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  archiveTaskTaxonomyEntry,
  createTaskTaxonomyEntry,
  updateTaskTaxonomyEntry,
} from "@/app/app/helphub/actions/task-taxonomy";
import {
  getTaskKeyDisplayLabel,
  normalizeTaskKey,
  type TaskKeyManagerInsights,
  type TaxonomyRow,
} from "@/lib/helphub/task-taxonomy";

export type TaxonomyListRow = {
  id: string;
  task_key: string;
  display_label: string;
  description: string | null;
  is_active: boolean;
  checklist_item_count?: number;
  /** Sampled from recent run rows (capped) when manager. */
  run_snapshot_count?: number;
};

export function TaskTaxonomyClient({
  initialRows,
  canManage,
  insights = null,
}: {
  initialRows: TaxonomyListRow[];
  canManage: boolean;
  insights?: TaskKeyManagerInsights | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return initialRows.filter((r) => {
      if (!showArchived && !r.is_active) return false;
      if (!needle) return true;
      return (
        r.task_key.toLowerCase().includes(needle) ||
        r.display_label.toLowerCase().includes(needle) ||
        (r.description ?? "").toLowerCase().includes(needle)
      );
    });
  }, [initialRows, q, showArchived]);

  const taxonomyForLabels = useMemo((): TaxonomyRow[] => {
    return initialRows.map((r) => ({
      task_key: r.task_key,
      display_label: r.display_label,
      is_active: r.is_active,
    }));
  }, [initialRows]);

  return (
    <div className="max-w-3xl space-y-8 pb-16">
      {msg ? <p className="text-sm text-destructive">{msg}</p> : null}

      {canManage && insights ? (
        <section className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3 text-sm">
          <h2 className="text-sm font-semibold">Task key health (last {insights.lookbackDays} days)</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">{insights.uncategorizedChecklistItemCount}</span> checklist
              lines without an explicit task key (fairness falls back to normalized task text).
            </li>
            <li>
              <span className="text-foreground font-medium">{insights.checklistItemsKeyWithoutTaxonomyLabel}</span>{" "}
              checklist lines with a key that has no active taxonomy label.
            </li>
            <li>
              <span className="text-foreground font-medium">{insights.similarTextDifferentKeyClusters.length}</span>{" "}
              groups of lines that share the same task wording but use different explicit keys.
            </li>
            <li>
              Reassignments logged: {insights.reassignmentEvents.templateTask} template ·{" "}
              {insights.reassignmentEvents.overrideTask} override
            </li>
          </ul>
          {insights.topUndesirableTaskKeys.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-foreground mb-1">Top signals: avoided / repeated undesirable</p>
              <ul className="text-xs space-y-0.5">
                {insights.topUndesirableTaskKeys.map((x) => (
                  <li key={x.key}>
                    <span className="font-medium">{getTaskKeyDisplayLabel(x.key, taxonomyForLabels)}</span>
                    <span className="text-muted-foreground font-mono ml-1">({x.key})</span> — {x.count}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {insights.similarTextDifferentKeyClusters.length > 0 ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Similar wording, different keys</summary>
              <ul className="mt-2 space-y-2 pl-1">
                {insights.similarTextDifferentKeyClusters.slice(0, 6).map((c) => (
                  <li key={c.textFingerprint} className="border-l-2 border-amber-500/40 pl-2">
                    <p className="text-muted-foreground truncate" title={c.sampleTaskText}>
                      {c.sampleTaskText}
                    </p>
                    <p className="font-mono text-[10px]">{c.keys.join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <p className="text-xs">
            <Link href="/app/fairness" className="underline underline-offset-2">
              Fairness dashboard
            </Link>{" "}
            ·{" "}
            <Link href="/app/checklists" className="underline underline-offset-2">
              Edit checklists
            </Link>
          </p>
        </section>
      ) : null}

      {canManage ? (
        <section className="rounded-lg border border-border/60 p-4 space-y-3">
          <h2 className="text-sm font-semibold">Add entry</h2>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setMsg(null);
              const fd = new FormData(e.currentTarget);
              const taskKeyRaw = String(fd.get("task_key") ?? "");
              const displayLabel = String(fd.get("display_label") ?? "");
              const description = String(fd.get("description") ?? "") || null;
              startTransition(async () => {
                const res = await createTaskTaxonomyEntry({ taskKeyRaw, displayLabel, description });
                if ("error" in res && res.error) setMsg(res.error);
                else {
                  (e.target as HTMLFormElement).reset();
                  router.refresh();
                }
              });
            }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Task key (stable id)</Label>
              <Input name="task_key" placeholder="e.g. restrooms" required disabled={pending} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Display label</Label>
              <Input name="display_label" placeholder="e.g. Restrooms and bathrooms" required disabled={pending} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Description (optional)</Label>
              <Input name="description" placeholder="Internal notes" disabled={pending} />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              Create
            </Button>
          </form>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px] space-y-1">
            <Label className="text-xs">Search</Label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Key or label" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        </div>

        <ul className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries match.</p>
          ) : (
            filtered.map((row) => (
              <li
                key={row.id}
                className={`rounded-md border border-border/60 p-3 space-y-2 ${row.is_active ? "" : "opacity-70"}`}
              >
                <div className="flex flex-wrap gap-2 justify-between items-start">
                  <div>
                    <p className="font-medium">{row.display_label}</p>
                    <p className="text-xs font-mono text-muted-foreground">{row.task_key}</p>
                    {typeof row.checklist_item_count === "number" ||
                    typeof row.run_snapshot_count === "number" ? (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Checklist lines: {row.checklist_item_count ?? 0}
                        {typeof row.run_snapshot_count === "number" ? (
                          <> · Run snapshots (sampled): {row.run_snapshot_count}</>
                        ) : null}
                      </p>
                    ) : null}
                    {row.description ? (
                      <p className="text-xs text-muted-foreground mt-1">{row.description}</p>
                    ) : null}
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      {row.is_active ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => {
                            setMsg(null);
                            startTransition(async () => {
                              const res = await archiveTaskTaxonomyEntry(row.id);
                              if ("error" in res && res.error) setMsg(res.error);
                              else router.refresh();
                            });
                          }}
                        >
                          Archive
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => {
                            setMsg(null);
                            startTransition(async () => {
                              const res = await updateTaskTaxonomyEntry(row.id, { isActive: true });
                              if ("error" in res && res.error) setMsg(res.error);
                              else router.refresh();
                            });
                          }}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>
                {canManage && row.is_active ? (
                  <EditRowForm
                    row={row}
                    pending={pending}
                    startTransition={startTransition}
                    onDone={() => router.refresh()}
                    onError={setMsg}
                  />
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function EditRowForm({
  row,
  pending,
  startTransition,
  onDone,
  onError,
}: {
  row: TaxonomyListRow;
  pending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
  onDone: () => void;
  onError: (s: string | null) => void;
}) {
  return (
    <form
      className="grid gap-2 sm:grid-cols-2 border-t border-border/40 pt-2 mt-2"
      onSubmit={(e) => {
        e.preventDefault();
        onError(null);
        const fd = new FormData(e.currentTarget);
        const displayLabel = String(fd.get("display_label") ?? "");
        const description = String(fd.get("description") ?? "") || null;
        const taskKeyRaw = String(fd.get("task_key") ?? "").trim();
        if (
          taskKeyRaw &&
          normalizeTaskKey(taskKeyRaw) !== normalizeTaskKey(row.task_key)
        ) {
          if (
            !confirm(
              "You are changing the taxonomy key string. Existing checklist items and historical run snapshots keep their stored keys until you edit them — this only updates the dictionary entry going forward."
            )
          ) {
            return;
          }
        }
        startTransition(async () => {
          const res = await updateTaskTaxonomyEntry(row.id, {
            displayLabel,
            description,
            taskKeyRaw: taskKeyRaw ? taskKeyRaw : undefined,
          });
          if ("error" in res && res.error) onError(res.error);
          else onDone();
        });
      }}
    >
      <div className="space-y-1">
        <Label className="text-[11px]">Task key</Label>
        <Input name="task_key" defaultValue={row.task_key} disabled={pending} />
      </div>
      <div className="space-y-1">
        <Label className="text-[11px]">Display label</Label>
        <Input name="display_label" defaultValue={row.display_label} required disabled={pending} />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-[11px]">Description</Label>
        <Input name="description" defaultValue={row.description ?? ""} disabled={pending} />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Save changes
      </Button>
    </form>
  );
}
