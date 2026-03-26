"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CommandCard } from "./command-card";
import type { OpsSeverity, MissingPhotoTask } from "./mock-data";
import { CameraOff } from "lucide-react";

function worst(a: OpsSeverity, b: OpsSeverity): OpsSeverity {
  const o = { normal: 0, warning: 1, problem: 2 };
  return o[a] >= o[b] ? a : b;
}

export function MissingPhotosCard({ items }: { items: MissingPhotoTask[] }) {
  const severity = items.reduce<OpsSeverity>((acc, r) => worst(acc, r.severity), "normal");

  return (
    <CommandCard
      title="Missing photo proof"
      eyebrow="Execution"
      severity={severity}
      badge={
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <CameraOff className="h-3 w-3" />
          Requires photo
        </span>
      }
      dense
    >
      {/* TODO: Supabase — run_items where requires_photo and proof_url null and not suppressed */}
      {items.length === 0 ? (
        <p className="px-3 py-5 text-center text-xs text-muted-foreground">All required proofs captured.</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{t.taskText}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {t.assigneeName} · {t.locationName}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                  <Link href="/app/shift-ops">Nudge</Link>
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" asChild>
                  <Link href="/app/checklist-runs">Open run</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CommandCard>
  );
}
