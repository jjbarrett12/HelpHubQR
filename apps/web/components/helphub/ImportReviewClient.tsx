"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  commitImportToChecklist,
  getImportSourceSignedUrl,
  replaceImportTasks,
  runChecklistImportProcessing,
  updateImportReviewMeta,
} from "@/app/app/helphub/actions/import-checklist";
import { createTaxonomyKeyFromTask } from "@/app/app/helphub/actions/task-taxonomy";
import {
  getBestTaskKeySuggestion,
  normalizeTaskKey,
  type TaxonomyRow,
} from "@/lib/helphub/task-taxonomy";

export type ImportTaskRow = {
  id: string;
  task_text: string;
  task_key?: string | null;
  sort_order: number;
  is_selected: boolean;
};

function BulkMapToTaxonomyKey({
  taxonomy,
  disabled,
  onApply,
}: {
  taxonomy: TaxonomyRow[];
  disabled: boolean;
  onApply: (taskKey: string) => void;
}) {
  const [v, setV] = useState("");
  return (
    <>
      <select
        className="h-9 rounded-md border border-input bg-background px-2 text-xs min-w-[180px]"
        value={v}
        onChange={(e) => setV(e.target.value)}
        disabled={disabled}
      >
        <option value="">Choose taxonomy key…</option>
        {taxonomy.map((t) => (
          <option key={t.task_key} value={t.task_key}>
            {t.display_label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || !v}
        onClick={() => onApply(v)}
      >
        Apply to checked lines
      </Button>
    </>
  );
}

type Props = {
  documentId: string;
  status: string;
  checklistName: string;
  shiftType: string | null;
  tasks: ImportTaskRow[];
  roles: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  errorMessage: string | null;
  aiNotes: string | null;
  ocrText: string | null;
  parseConfidence: number | null;
  ocrConfidence: number | null;
  taxonomy?: TaxonomyRow[];
};

export function ImportReviewClient({
  documentId,
  status: initialStatus,
  checklistName: initialName,
  shiftType: initialShift,
  tasks: initialTasks,
  roles,
  locations,
  errorMessage: initialErr,
  aiNotes,
  ocrText,
  parseConfidence,
  ocrConfidence,
  taxonomy = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState(initialStatus);
  const [name, setName] = useState(initialName);
  const [shift, setShift] = useState(initialShift ?? "");
  const [tasks, setTasks] = useState(() =>
    initialTasks.map((t) => ({ ...t }))
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(initialErr);
  const [staffRoleId, setStaffRoleId] = useState(roles[0]?.id ?? "");
  const [locationId, setLocationId] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    setStatus(initialStatus);
    setName(initialName);
    setShift(initialShift ?? "");
    setTasks(initialTasks.map((t) => ({ ...t })));
    setActionError(initialErr);
  }, [initialStatus, initialName, initialShift, initialTasks, initialErr]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await getImportSourceSignedUrl(documentId);
      if (!cancelled && "url" in res) setPreviewUrl(res.url);
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (status !== "processing") return;
    const t = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(t);
  }, [status, router]);

  const taskPayload = useMemo(() => {
    return tasks
      .map((t) => ({
        task_text: t.task_text.trim(),
        is_selected: t.is_selected,
        task_key: t.task_key?.trim() ? t.task_key.trim() : null,
      }))
      .filter((t) => t.task_text.length > 0);
  }, [tasks]);

  const taxonomyListId = `import-taxonomy-${documentId}`;

  const persistTasks = useCallback(() => {
    startTransition(async () => {
      const res = await replaceImportTasks(documentId, taskPayload);
      if ("error" in res && res.error) setActionError(res.error);
      else router.refresh();
    });
  }, [documentId, taskPayload, router]);

  function move(index: number, dir: -1 | 1) {
    const next = [...tasks];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    setTasks(next);
  }

  if (status === "processing") {
    return (
      <div className="max-w-lg space-y-4 py-8">
        <p className="text-lg font-medium">Analyzing your image…</p>
        <p className="text-sm text-muted-foreground">OCR and AI structuring run on the server. This page refreshes automatically.</p>
      </div>
    );
  }

  if (status === "uploaded") {
    return (
      <div className="max-w-lg space-y-4 py-8">
        <p className="text-sm text-muted-foreground">Processing has not started yet.</p>
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            setActionError(null);
            startTransition(async () => {
              const res = await runChecklistImportProcessing(documentId);
              if ("error" in res && res.error) setActionError(res.error);
              else {
                setStatus("processing");
                router.refresh();
              }
            });
          }}
        >
          Start AI processing
        </Button>
        {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="max-w-lg space-y-4 py-8">
        <p className="font-medium text-destructive">Import failed</p>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{actionError ?? initialErr ?? "Unknown error"}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setActionError(null);
              startTransition(async () => {
                const res = await runChecklistImportProcessing(documentId);
                if ("error" in res && res.error) setActionError(res.error);
                else {
                  setStatus("processing");
                  router.refresh();
                }
              });
            }}
          >
            Retry processing
          </Button>
          <Button variant="outline" asChild>
            <Link href="/app/checklists/import">Upload another</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="max-w-lg space-y-4 py-8">
        <p className="font-medium">This import was saved as a checklist.</p>
        <Button asChild>
          <Link href="/app/checklists">Back to checklists</Link>
        </Button>
      </div>
    );
  }

  if (status !== "review") {
    return <p className="text-sm text-muted-foreground">Unexpected status: {status}</p>;
  }

  return (
    <div className="max-w-2xl space-y-8 pb-16">
      <div className="flex flex-wrap gap-4 items-start">
        {previewUrl ? (
          <div className="w-full sm:w-56 shrink-0 rounded-md border overflow-hidden bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Uploaded source" className="w-full h-auto object-contain max-h-64" />
          </div>
        ) : null}
        <div className="flex-1 min-w-0 space-y-2 text-sm">
          <p className="text-muted-foreground">
            Review AI output before saving. Edit tasks, drop lines that are noise, and assign role & shift.
          </p>
          {(ocrConfidence != null || parseConfidence != null) && (
            <p className="text-xs text-muted-foreground">
              Confidence: OCR {ocrConfidence != null ? `${Math.round(ocrConfidence * 100)}%` : "n/a"} · parse{" "}
              {parseConfidence != null ? `${Math.round(parseConfidence * 100)}%` : "n/a"}
            </p>
          )}
          {aiNotes ? (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">AI notes</summary>
              <p className="mt-1 whitespace-pre-wrap">{aiNotes}</p>
            </details>
          ) : null}
          {ocrText ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Raw OCR text</summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded border bg-muted/20 p-2 whitespace-pre-wrap">{ocrText}</pre>
            </details>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cname">Checklist name</Label>
          <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Shift type</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={shift}
            onChange={(e) => setShift(e.target.value)}
          >
            <option value="">Choose…</option>
            <option value="open">Open</option>
            <option value="mid">Mid</option>
            <option value="close">Close</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Staff role</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={staffRoleId}
            onChange={(e) => setStaffRoleId(e.target.value)}
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Location (optional)</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Input
            id="description"
            placeholder="Shown on checklist settings"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setActionError(null);
            startTransition(async () => {
              const meta = await updateImportReviewMeta(documentId, name, shift || null);
              if ("error" in meta && meta.error) {
                setActionError(meta.error);
                return;
              }
              const res = await replaceImportTasks(documentId, taskPayload);
              if ("error" in res && res.error) setActionError(res.error);
              else router.refresh();
            });
          }}
        >
          Save draft
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (!confirm("Re-run OCR and AI? Your current task edits will be replaced.")) return;
            setActionError(null);
            startTransition(async () => {
              const res = await runChecklistImportProcessing(documentId, { force: true });
              if ("error" in res && res.error) setActionError(res.error);
              else {
                setStatus("processing");
                router.refresh();
              }
            });
          }}
        >
          Reprocess from image
        </Button>
      </div>
      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

      <div className="space-y-3">
        {taxonomy.length > 0 ? (
          <datalist id={taxonomyListId}>
            {taxonomy.map((t) => (
              <option key={t.task_key} value={t.task_key}>
                {t.display_label}
              </option>
            ))}
          </datalist>
        ) : null}
        <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs space-y-2">
          <p className="font-medium text-sm text-foreground">Task keys</p>
          <p className="text-muted-foreground">
            Standardize keys before creating the checklist so fairness and employee preferences stay trustworthy. Keys are
            normalized on save.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setTasks((cur) =>
                  cur.map((row) => ({
                    ...row,
                    task_key: getBestTaskKeySuggestion(row.task_text, taxonomy),
                  }))
                );
              }}
            >
              Apply all suggestions
            </Button>
            <span className="text-muted-foreground">Map checked lines (for import) to one taxonomy key:</span>
            <BulkMapToTaxonomyKey
              taxonomy={taxonomy}
              disabled={pending}
              onApply={(taskKey) => {
                setTasks((cur) =>
                  cur.map((row) => (row.is_selected ? { ...row, task_key: taskKey } : row))
                );
              }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-base">Tasks</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setTasks((t) => [
                ...t,
                {
                  id: `new-${Date.now()}`,
                  task_text: "",
                  task_key: null,
                  sort_order: t.length,
                  is_selected: true,
                },
              ]);
            }}
          >
            Add row
          </Button>
        </div>
        <ul className="space-y-2">
          {tasks.map((t, index) => {
            const liveSuggest = getBestTaskKeySuggestion(t.task_text, taxonomy);
            const rowKeyNorm = t.task_key?.trim() ? normalizeTaskKey(t.task_key) : "";
            const taxMatch = taxonomy.find((tr) => normalizeTaskKey(tr.task_key) === rowKeyNorm);
            const selectValue = taxMatch ? taxMatch.task_key : "__custom__";
            return (
            <li key={t.id} className="flex flex-col gap-2 rounded-md border border-border/60 p-2">
              <div className="flex flex-wrap gap-2 items-center">
              <input
                type="checkbox"
                checked={t.is_selected}
                onChange={(e) => {
                  const next = [...tasks];
                  next[index] = { ...next[index], is_selected: e.target.checked };
                  setTasks(next);
                }}
                aria-label="Include task"
              />
              <Input
                className="flex-1 min-w-[200px]"
                value={t.task_text}
                onChange={(e) => {
                  const next = [...tasks];
                  next[index] = { ...next[index], task_text: e.target.value };
                  setTasks(next);
                }}
                placeholder="Task text"
              />
              <select
                className="h-10 min-w-[160px] max-w-[220px] rounded-md border border-input bg-background px-2 text-xs"
                value={selectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = [...tasks];
                  if (v === "__custom__") {
                    next[index] = { ...next[index], task_key: next[index].task_key };
                  } else {
                    next[index] = { ...next[index], task_key: v };
                  }
                  setTasks(next);
                }}
                title="Pick a taxonomy key or choose custom"
              >
                <option value="__custom__">Custom key…</option>
                {taxonomy.map((tx) => (
                  <option key={tx.task_key} value={tx.task_key}>
                    {tx.display_label}
                  </option>
                ))}
              </select>
              <Input
                className="w-[140px] min-w-[100px] text-xs font-mono"
                value={t.task_key ?? ""}
                onChange={(e) => {
                  const next = [...tasks];
                  next[index] = { ...next[index], task_key: e.target.value || null };
                  setTasks(next);
                }}
                placeholder="Task key"
                list={taxonomy.length > 0 ? taxonomyListId : undefined}
                title="Normalized key; use taxonomy picker or type"
              />
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => move(index, -1)}>
                  Up
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === tasks.length - 1}
                  onClick={() => move(index, 1)}
                >
                  Down
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setTasks((cur) => cur.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground pl-7">
                <span>
                  Suggested: <code className="font-mono text-foreground">{liveSuggest}</code>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => {
                    const next = [...tasks];
                    next[index] = { ...next[index], task_key: liveSuggest };
                    setTasks(next);
                  }}
                >
                  Use suggestion
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px]"
                  disabled={pending || !t.task_text.trim()}
                  onClick={() => {
                    setActionError(null);
                    startTransition(async () => {
                      const res = await createTaxonomyKeyFromTask({
                        taskText: t.task_text,
                        displayLabel: t.task_text.trim().slice(0, 120),
                      });
                      if ("error" in res && res.error) setActionError(res.error);
                      else if ("task_key" in res && res.task_key) {
                        const next = [...tasks];
                        next[index] = { ...next[index], task_key: res.task_key };
                        setTasks(next);
                        router.refresh();
                      }
                    });
                  }}
                >
                  Add taxonomy from line
                </Button>
              </div>
            </li>
          );
          })}
        </ul>
        <Button type="button" variant="outline" size="sm" onClick={persistTasks}>
          Sync tasks to server
        </Button>
      </div>

      <form
        className="space-y-4 border-t pt-6"
        onSubmit={(e) => {
          e.preventDefault();
          setCommitError(null);
          startTransition(async () => {
            if (!staffRoleId) {
              setCommitError("Select a staff role.");
              return;
            }
            if (!shift) {
              setCommitError("Select a shift type.");
              return;
            }
            if (taskPayload.length === 0) {
              setCommitError("Add at least one non-empty task.");
              return;
            }
            const meta = await updateImportReviewMeta(documentId, name, shift || null);
            if ("error" in meta && meta.error) {
              setCommitError(meta.error);
              return;
            }
            const resTasks = await replaceImportTasks(documentId, taskPayload);
            if ("error" in resTasks && resTasks.error) {
              setCommitError(resTasks.error);
              return;
            }
            const fd = new FormData();
            fd.set("document_id", documentId);
            fd.set("checklist_name", name);
            fd.set("shift_type", shift);
            fd.set("staff_role_id", staffRoleId);
            fd.set("location_id", locationId);
            fd.set("description", description);
            const res = await commitImportToChecklist(fd);
            if ("error" in res && res.error) {
              setCommitError(res.error);
              return;
            }
            if ("checklistId" in res) {
              router.push(`/app/checklists/templates/${res.checklistId}`);
              router.refresh();
            }
          });
        }}
      >
        {commitError ? <p className="text-sm text-destructive">{commitError}</p> : null}
        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
          Create live checklist
        </Button>
        <p className="text-xs text-muted-foreground">
          Saves to your normal checklists and marks this import completed. The source image stays in storage for audit.
        </p>
      </form>
    </div>
  );
}
