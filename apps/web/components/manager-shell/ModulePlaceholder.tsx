import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OperationalSection } from "./OperationalSection";
import { PageHeader } from "./PageHeader";

export type ModulePlaceholderProps = {
  kicker: string;
  title: string;
  description: string;
  body: string;
  nextSteps?: { label: string; href: string }[];
  /** Supabase: document which tables / RPCs will feed this module */
  dataHookNote?: string;
};

export function ModulePlaceholder({
  kicker,
  title,
  description,
  body,
  nextSteps = [],
  dataHookNote,
}: ModulePlaceholderProps) {
  return (
    <div className="min-h-full bg-[var(--app-bg)]">
      <PageHeader title={title} description={description} kicker={kicker} />
      <div className="space-y-6 px-4 py-6 md:px-8 md:py-8 max-w-4xl">
        <OperationalSection title="Overview" description="This area is wired for product logic next — no filler metrics.">
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </OperationalSection>
        {nextSteps.length > 0 ? (
          <OperationalSection title="Related actions" dense>
            <ul className="divide-y divide-border/50">
              {nextSteps.map((s) => (
                <li key={s.href} className="flex items-center justify-between gap-3 px-4 py-3 first:pt-2">
                  <span className="text-sm font-medium text-foreground">{s.label}</span>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={s.href}>Open</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </OperationalSection>
        ) : null}
        {dataHookNote ? (
          <p className="text-xs font-mono text-muted-foreground border border-dashed border-border/60 rounded-lg px-3 py-2">
            <span className="text-foreground/80">Data next: </span>
            {dataHookNote}
          </p>
        ) : null}
      </div>
    </div>
  );
}
