import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const launchVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  created: "secondary",
  in_progress: "default",
  blocked: "destructive",
  launched: "default",
  churned: "outline",
};

export function LaunchStateBadge({ state }: { state: string | null | undefined }) {
  const s = state ?? "—";
  const variant = launchVariants[s] ?? "outline";
  return (
    <Badge variant={variant} className={cn(s === "launched" && "bg-emerald-600 hover:bg-emerald-600")}>
      {s}
    </Badge>
  );
}

export function StepStatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed"
      ? "default"
      : status === "failed"
        ? "destructive"
        : status === "skipped"
          ? "outline"
          : "secondary";
  return (
    <Badge
      variant={variant}
      className={cn(
        "font-mono text-[10px]",
        status === "completed" && "bg-emerald-700/90 hover:bg-emerald-700/90 text-white"
      )}
    >
      {status}
    </Badge>
  );
}

export function ProvisioningEventStatusBadge({ status }: { status: string }) {
  const variant =
    status === "succeeded"
      ? "default"
      : status === "failed"
        ? "destructive"
        : status === "started"
          ? "secondary"
          : "outline";
  return (
    <Badge
      variant={variant}
      className={cn(status === "succeeded" && "bg-emerald-700/90 hover:bg-emerald-700/90 text-white")}
    >
      {status}
    </Badge>
  );
}

export function BlockerPill({ active }: { active: boolean }) {
  if (!active) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-xs font-medium border border-amber-500/40">
      Blocker
    </span>
  );
}
