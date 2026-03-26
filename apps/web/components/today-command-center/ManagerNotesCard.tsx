"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CommandCard, formatRelativeMinutes } from "./command-card";
import type { ManagerNote } from "./mock-data";

export function ManagerNotesCard({
  notes: initialNotes,
}: {
  notes: ManagerNote[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");

  function addNote() {
    const body = draft.trim();
    if (!body) return;
    // TODO: Supabase — insert manager_shift_notes (org_id, author_user_id, body, shift_date)
    setNotes((n) => [
      {
        id: `local-${Date.now()}`,
        authorLabel: "You",
        body,
        createdAt: new Date().toISOString(),
      },
      ...n,
    ]);
    setDraft("");
  }

  return (
    <CommandCard
      title="Manager notes log"
      eyebrow="Today"
      severity="normal"
      actions={
        <Button size="sm" className="h-8 text-xs" type="button" onClick={addNote} disabled={!draft.trim()}>
          Log note
        </Button>
      }
    >
      <div className="space-y-3 px-1">
        <Textarea
          placeholder="Handoff, incidents, VIP arrivals — one line can save the next shift."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-[72px] text-sm resize-y"
          rows={3}
        />
        {notes.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-2">No notes logged yet today.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-y-auto border-t border-border/50 pt-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-md border border-border/40 bg-muted/20 px-3 py-2">
                <div className="flex justify-between gap-2 text-[10px] text-muted-foreground">
                  <span className="font-medium text-foreground">{n.authorLabel}</span>
                  <span className="font-mono">{formatRelativeMinutes(n.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-foreground leading-snug">{n.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CommandCard>
  );
}
