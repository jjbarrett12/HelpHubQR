"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
  updateChecklistItem,
} from "@/app/app/helphub/actions/checklists";
import { bulkApplySuggestedTaskKeysToChecklist } from "@/app/app/helphub/actions/task-taxonomy";
import {
  getBestTaskKeySuggestion,
  getTaskKeyDisplayLabel,
  resolveCanonicalTaskKey,
  type TaxonomyRow,
} from "@/lib/helphub/task-taxonomy";

type Item = {
  id: string;
  task_text: string;
  task_key?: string | null;
  sort_order: number;
  requires_photo: boolean;
  section_title?: string | null;
  duration_estimate_minutes?: number | null;
};

export function ChecklistItemsEditor({
  checklistId,
  items,
  taxonomy = [],
}: {
  checklistId: string;
  items: Item[];
  taxonomy?: TaxonomyRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const activeTaxonomy = useMemo(() => taxonomy.filter((t) => t.is_active !== false), [taxonomy]);
  const taxonomyListId = `taxonomy-keys-${checklistId}`;

  const suggestionsById = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of items) {
      m.set(it.id, getBestTaskKeySuggestion(it.task_text, activeTaxonomy));
    }
    return m;
  }, [items, activeTaxonomy]);

  function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    const orderedIds = next.map((i) => i.id);
    startTransition(async () => {
      await reorderChecklistItems(checklistId, orderedIds);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <datalist id={taxonomyListId}>
        {activeTaxonomy.map((t) => (
          <option key={t.task_key} value={t.task_key}>
            {t.display_label}
          </option>
        ))}
      </datalist>
      <p className="text-xs text-muted-foreground">
        <strong>Task key</strong> is the operational category for preferences and fairness (stored on each checklist line;
        runs snapshot it). Saving is never blocked, but missing keys make signals noisy. Use your{" "}
        <Link href="/app/task-taxonomy" className="underline underline-offset-2">
          task taxonomy
        </Link>{" "}
        for shared labels.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const res = await bulkApplySuggestedTaskKeysToChecklist(checklistId, "empty_only");
              if ("error" in res && res.error) alert(res.error);
              else router.refresh();
            });
          }}
        >
          Apply suggested keys (empty only)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                "Replace task keys on all rows with the current suggestion for each line? You can still edit after."
              )
            )
              return;
            startTransition(async () => {
              const res = await bulkApplySuggestedTaskKeysToChecklist(checklistId, "all");
              if ("error" in res && res.error) alert(res.error);
              else router.refresh();
            });
          }}
        >
          Apply suggestions to entire checklist
        </Button>
      </div>
      <ul className="space-y-2">
        {items.map((it, index) => {
          const suggested = suggestionsById.get(it.id) ?? "";
          const effective = resolveCanonicalTaskKey(it.task_key, it.task_text);
          const label = getTaskKeyDisplayLabel(effective, taxonomy);
          const missingExplicit = !it.task_key?.trim();
          const prev = items[index - 1];
          const sectionKey = it.section_title?.trim() ?? "";
          const prevSectionKey = prev?.section_title?.trim() ?? "";
          const showSectionHeader = !prev || sectionKey !== prevSectionKey;
          return (
            <Fragment key={it.id}>
              {showSectionHeader ? (
                <li className="list-none pt-2 first:pt-0">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-1">
                    {sectionKey || "General"}
                  </div>
                </li>
              ) : null}
              <li
                className={`rounded-md border p-3 space-y-2 ${
                  missingExplicit ? "border-amber-500/40 bg-amber-500/5" : "border-border/60"
                }`}
              >
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    startTransition(async () => {
                      await updateChecklistItem(fd);
                      router.refresh();
                    });
                  }}
                >
                  <input type="hidden" name="id" value={it.id} />
                  <div className="flex flex-wrap gap-2 items-center text-[11px]">
                    {missingExplicit ? (
                      <span className="rounded border border-amber-600/50 bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-900 dark:text-amber-100">
                        Uncategorized key
                      </span>
                    ) : (
                      <span className="rounded border border-border/60 px-1.5 py-0.5 text-muted-foreground">
                        Key set
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      Taxonomy label: <span className="font-medium text-foreground">{label}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 items-start">
                    <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Task text</span>
                      <Input name="task_text" defaultValue={it.task_text} className="w-full" />
                    </div>
                    <div className="flex flex-col gap-0.5 w-[160px] min-w-[120px]">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Section</span>
                      <Input
                        name="section_title"
                        defaultValue={it.section_title ?? ""}
                        placeholder="e.g. Floors"
                        className="w-full text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5 w-[88px] min-w-[72px]">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Min est.</span>
                      <Input
                        name="duration_estimate_minutes"
                        type="number"
                        min={0}
                        step={1}
                        defaultValue={it.duration_estimate_minutes ?? ""}
                        placeholder="—"
                        className="w-full text-xs tabular-nums"
                      />
                    </div>
                    <div className="flex flex-col gap-0.5 w-[200px] min-w-[140px]">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Task key</span>
                      <Input
                        name="task_key"
                        defaultValue={it.task_key ?? ""}
                        list={activeTaxonomy.length > 0 ? taxonomyListId : undefined}
                        placeholder="e.g. restrooms"
                        className="w-full text-xs font-mono"
                        title="Pick from taxonomy or type a normalized key; blank = derive from text at run time"
                      />
                    </div>
                    <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap mt-5">
                      <input type="checkbox" name="requires_photo" value="true" defaultChecked={it.requires_photo} />
                      Photo req.
                    </label>
                    <Button type="submit" size="sm" variant="secondary" disabled={pending} className="mt-5">
                      Save
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground items-center">
                    <span>
                      Suggested key: <code className="font-mono text-foreground">{suggested || "—"}</code>
                    </span>
                    <span>
                      Normalized preview: <code className="font-mono">{effective}</code>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px]"
                      disabled={pending || !suggested}
                      onClick={(ev) => {
                        ev.preventDefault();
                        const form = (ev.currentTarget.closest("li") as HTMLElement).querySelector("form");
                        const input = form?.querySelector<HTMLInputElement>('input[name="task_key"]');
                        if (input) {
                          input.value = suggested;
                          form?.requestSubmit();
                        }
                      }}
                    >
                      Use suggestion
                    </Button>
                  </div>
                </form>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={pending || index === 0} onClick={() => move(index, -1)}>
                    Up
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending || index === items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    Down
                  </Button>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      startTransition(async () => {
                        await deleteChecklistItem(it.id);
                        router.refresh();
                      });
                    }}
                  >
                    <Button type="submit" size="sm" variant="ghost" className="text-destructive" disabled={pending}>
                      Remove
                    </Button>
                  </form>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ul>

      <form
        className="rounded-lg border border-dashed border-border/70 bg-muted/10 p-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("checklist_id", checklistId);
          startTransition(async () => {
            await addChecklistItem(fd);
            (e.currentTarget as HTMLFormElement).reset();
            router.refresh();
          });
        }}
      >
        <p className="text-xs font-medium text-muted-foreground">Add task</p>
        <div className="flex flex-wrap gap-2 items-end">
          <input type="hidden" name="checklist_id" value={checklistId} />
          <div className="flex flex-col gap-0.5 flex-1 min-w-[200px]">
            <span className="text-[10px] uppercase text-muted-foreground">Task text</span>
            <Input name="task_text" placeholder="New task" required />
          </div>
          <div className="flex flex-col gap-0.5 w-[140px]">
            <span className="text-[10px] uppercase text-muted-foreground">Section</span>
            <Input name="section_title" placeholder="Optional" />
          </div>
          <div className="flex flex-col gap-0.5 w-[80px]">
            <span className="text-[10px] uppercase text-muted-foreground">Min</span>
            <Input name="duration_estimate_minutes" type="number" min={0} placeholder="—" className="tabular-nums" />
          </div>
          <div className="flex flex-col gap-0.5 w-[140px]">
            <span className="text-[10px] uppercase text-muted-foreground">Task key</span>
            <Input
              name="task_key"
              placeholder="Key"
              className="text-xs font-mono"
              list={activeTaxonomy.length > 0 ? taxonomyListId : undefined}
            />
          </div>
          <label className="flex items-center gap-1 text-xs text-muted-foreground pb-2">
            <input type="checkbox" name="requires_photo" value="true" />
            Photo
          </label>
          <Button type="submit" disabled={pending}>
            Add
          </Button>
        </div>
      </form>
    </div>
  );
}
