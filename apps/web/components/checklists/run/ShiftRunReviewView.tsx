import type { RunReviewViewModel } from "@/lib/checklists/run-review-view-model";
import { RunReviewHeader } from "./RunReviewHeader";
import { RunTaskExecutionRow } from "./RunTaskExecutionRow";

export function ShiftRunReviewView({
  model,
  backHref,
}: {
  model: RunReviewViewModel;
  backHref: string;
}) {
  let lastSection: string | null = null;

  return (
    <div className="min-h-full flex flex-col">
      <RunReviewHeader model={model} backHref={backHref} />
      <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-3xl w-full mx-auto space-y-4">
        {model.tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 py-16 text-center text-sm text-muted-foreground px-4">
            No run items returned. If this run was just created, refresh after the checklist is attached.
            {/* TODO: verify shift_checklist_run_items insert path */}
          </div>
        ) : (
          <ul className="space-y-3">
            {model.tasks.map((task) => {
              const key = task.sectionTitle?.trim() || "";
              const showSection = key !== lastSection;
              lastSection = key;
              return (
                <li key={task.id} className="space-y-2">
                  {showSection ? (
                    <div className="pt-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border-b border-border/50 pb-1">
                        {key || "General"}
                      </p>
                    </div>
                  ) : null}
                  <RunTaskExecutionRow task={task} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
