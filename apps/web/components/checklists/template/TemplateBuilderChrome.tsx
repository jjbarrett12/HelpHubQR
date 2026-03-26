import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function TemplateBuilderChrome({
  templateName,
  subtitle,
  isActive,
}: {
  templateName: string;
  subtitle: string;
  isActive: boolean;
}) {
  return (
    <header className="border-b border-border/60 bg-[var(--app-bg)]/95 px-4 py-4 md:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Checklist template · definition only
          </p>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl break-words">{templateName}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
          <p className="text-[11px] text-muted-foreground max-w-2xl leading-relaxed">
            You are editing the reusable template. Shift runs snapshot tasks when issued — they do not live-update when you
            save here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isActive ? (
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-800 dark:text-emerald-200">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/app/checklists?hub=templates">Hub</Link>
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/app/checklists?hub=runs">Active runs</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
