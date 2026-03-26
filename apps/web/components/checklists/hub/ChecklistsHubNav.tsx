"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const HUBS = [
  { id: "templates", label: "Templates" },
  { id: "runs", label: "Active runs" },
  { id: "import", label: "Import review" },
  { id: "history", label: "History" },
  { id: "taxonomy", label: "Task taxonomy" },
] as const;

export type ChecklistsHubId = (typeof HUBS)[number]["id"];

export function ChecklistsHubNav({ activeHub }: { activeHub: ChecklistsHubId }) {
  const searchParams = useSearchParams();

  function hrefFor(hub: ChecklistsHubId) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("hub", hub);
    const q = next.toString();
    return q ? `/app/checklists?${q}` : "/app/checklists";
  }

  return (
    <div className="border-b border-border/60 bg-muted/20 px-4 py-2 md:px-6">
      <nav className="flex flex-wrap gap-1" aria-label="Checklists hub">
        {HUBS.map((h) => (
          <Link
            key={h.id}
            href={hrefFor(h.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeHub === h.id
                ? "bg-background text-foreground shadow-sm border border-border/70"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60"
            )}
          >
            {h.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
