import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RunReviewTaskView } from "@/lib/checklists/run-review-view-model";
import { deriveRunTaskSignals } from "@/lib/checklists/run-review-view-model";

export function RunTaskExecutionRow({ task }: { task: RunReviewTaskView }) {
  const { missingProof, isProblem } = deriveRunTaskSignals(task);
  const showProblem = isProblem || Boolean(task.problemReason);

  return (
    <Card
      className={cn(
        "border-border/70 shadow-none overflow-hidden",
        task.suppressed && "opacity-60 border-dashed",
        showProblem && "border-red-500/40 bg-red-500/[0.04]",
        !showProblem && task.completed && "border-emerald-500/25 bg-emerald-500/[0.03]"
      )}
    >
      <CardContent className="p-3 sm:p-4 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {task.completed ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Done</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Open
                </Badge>
              )}
              {task.requiresPhoto ? (
                <Badge variant="outline" className="text-[10px]">
                  Photo required
                </Badge>
              ) : null}
              {missingProof ? (
                <Badge variant="destructive" className="text-[10px]">
                  Missing proof
                </Badge>
              ) : null}
              {task.proofPhotoStoragePath ? (
                <Badge variant="outline" className="text-[10px] border-sky-500/40 text-sky-800 dark:text-sky-200">
                  Proof on file
                </Badge>
              ) : null}
              {task.overrideSource !== "template" ? (
                <Badge variant="outline" className="text-[10px]">
                  Override · {task.overrideSource.replace(/_/g, " ")}
                </Badge>
              ) : null}
              {task.suppressed ? (
                <Badge variant="secondary" className="text-[10px]">
                  Suppressed
                </Badge>
              ) : null}
            </div>
            <p className="text-sm font-semibold leading-snug text-foreground">{task.taskText}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {task.sectionTitle ? <span>Section: {task.sectionTitle}</span> : null}
              {task.durationEstimateMinutes != null ? (
                <span className="tabular-nums">Est. {task.durationEstimateMinutes} min</span>
              ) : null}
              {task.taskKeySnapshot ? (
                <span>
                  Key: <code className="font-mono text-foreground/90">{task.taskKeySnapshot}</code>
                </span>
              ) : (
                <span>No key snapshot</span>
              )}
            </div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground shrink-0 space-y-0.5">
            <div>
              Completed:{" "}
              <span className="font-medium text-foreground tabular-nums">
                {task.completedAt ? new Date(task.completedAt).toLocaleString() : "—"}
              </span>
            </div>
            {task.assignedEmployeeName ? (
              <div>
                Assigned: <span className="font-medium text-foreground">{task.assignedEmployeeName}</span>
              </div>
            ) : null}
            <div className="text-[10px]">Status: {task.assignmentStatus}</div>
          </div>
        </div>

        {task.blockedReason || task.overrideReason || task.notes || task.problemReason ? (
          <div className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-2 space-y-1.5 text-xs">
            {task.blockedReason ? (
              <p>
                <span className="font-semibold text-foreground">Blocked: </span>
                {task.blockedReason}
              </p>
            ) : null}
            {task.problemReason ? (
              <p className="text-red-700 dark:text-red-300">
                <span className="font-semibold">Problem: </span>
                {task.problemReason}
              </p>
            ) : null}
            {task.overrideReason ? (
              <p>
                <span className="font-semibold text-foreground">Override note: </span>
                {task.overrideReason}
              </p>
            ) : null}
            {task.notes ? (
              <p>
                <span className="font-semibold text-foreground">Comment: </span>
                {task.notes}
              </p>
            ) : null}
          </div>
        ) : null}

        {task.proofPhotoStoragePath ? (
          <div className="rounded-md border border-sky-500/30 bg-sky-500/[0.06] px-2.5 py-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Proof object: </span>
            <code className="break-all font-mono text-[10px]">{task.proofPhotoStoragePath}</code>
            <p className="mt-1">
              {/* TODO: Supabase storage — createSignedUrl for private bucket; render thumbnail */}
              Signed URL preview not wired yet.
            </p>
          </div>
        ) : task.requiresPhoto && task.completed ? (
          <p className="text-[11px] text-amber-800 dark:text-amber-200">Photo was required for completion — none stored.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
