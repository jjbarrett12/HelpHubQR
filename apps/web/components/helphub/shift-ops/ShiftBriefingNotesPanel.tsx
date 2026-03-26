"use client";

import { useState, useTransition } from "react";
import { addShiftBriefingNote } from "@/app/app/helphub/actions/shift-briefing";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ShiftBriefingNoteRow = {
  id: string;
  note: string;
  created_at: string;
  visible_to_employee: boolean;
};

type Props = {
  shiftId: string;
  notes: ShiftBriefingNoteRow[];
  disabled?: boolean;
  onRefresh: () => void;
};

export function ShiftBriefingNotesPanel({ shiftId, notes, disabled, onRefresh }: Props) {
  const [draft, setDraft] = useState("");
  const [visible, setVisible] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Shift briefing / notes
        </p>
        <span className="text-[10px] text-muted-foreground">Shown on employee Today (when visible)</span>
      </div>

      {notes.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border bg-background/60 px-3 py-2">
              <p className="whitespace-pre-wrap">{n.note}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {new Date(n.created_at).toLocaleString()}
                {!n.visible_to_employee ? (
                  <span className="ml-2 text-amber-700 dark:text-amber-400">Internal only</span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No briefing notes yet for this shift.</p>
      )}

      {err ? <p className="text-xs text-destructive">{err}</p> : null}

      <div className="space-y-2">
        <Label htmlFor={`briefing-${shiftId}`} className="text-xs">
          Add note
        </Label>
        <Textarea
          id={`briefing-${shiftId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Operational briefing for this shift (not a chat thread)."
          rows={3}
          disabled={disabled || pending}
          className="text-sm resize-y min-h-[72px]"
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            disabled={disabled || pending}
          />
          Visible to assigned employee on Today
        </label>
        <Button
          type="button"
          size="sm"
          disabled={disabled || pending || !draft.trim()}
          onClick={() => {
            setErr(null);
            startTransition(async () => {
              const res = await addShiftBriefingNote({
                employeeShiftId: shiftId,
                note: draft,
                visibleToEmployee: visible,
              });
              if (res.error) {
                setErr(res.error);
                return;
              }
              setDraft("");
              onRefresh();
            });
          }}
        >
          {pending ? "Saving…" : "Post note"}
        </Button>
      </div>
    </div>
  );
}
