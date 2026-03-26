"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteEmployeeSchedulePreference,
  deleteEmployeeTaskPreference,
  upsertEmployeeSchedulePreference,
  upsertEmployeeTaskPreference,
  upsertEmployeeWorkPreferences,
} from "@/app/app/helphub/actions/fairness-preferences";
import { getTaskKeyDisplayLabel, type TaxonomyRow } from "@/lib/helphub/task-taxonomy";

const SHIFT_TYPES = ["open", "mid", "close", "custom"] as const;

export type TaskPref = {
  preference_key: string;
  preference_label: string | null;
  preference_level: string;
};
export type SchedPref = {
  id: string;
  weekday: number | null;
  shift_type: string | null;
  preference_level: string;
};
export type WorkPref = {
  wants_extra_hours: boolean;
  open_to_same_day_coverage: boolean;
  open_to_weekend_shifts: boolean;
  prefers_consistent_schedule: boolean;
  max_shifts_per_week: number | null;
  max_hours_per_week: number | null;
  notes: string | null;
};

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  employeeId: string;
  taskPrefs: TaskPref[];
  schedulePrefs: SchedPref[];
  workPrefs: WorkPref | null;
  /** All taxonomy rows (include archived) so labels resolve for older preference keys. */
  taxonomy?: TaxonomyRow[];
};

export function PreferencesEditor({
  employeeId,
  taskPrefs,
  schedulePrefs,
  workPrefs,
  taxonomy = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string }>) => {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res && res.error) setMsg(res.error);
      else router.refresh();
    });
  };

  const groupedTaskPrefs = useMemo(() => {
    const buckets = new Map<string, TaskPref[]>();
    for (const t of taskPrefs) {
      const lab = getTaskKeyDisplayLabel(t.preference_key, taxonomy);
      const heading =
        lab !== t.preference_key ? lab : `Uncategorized key · ${t.preference_key}`;
      if (!buckets.has(heading)) buckets.set(heading, []);
      buckets.get(heading)!.push(t);
    }
    return [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [taskPrefs, taxonomy]);

  const w = workPrefs ?? {
    wants_extra_hours: false,
    open_to_same_day_coverage: false,
    open_to_weekend_shifts: false,
    prefers_consistent_schedule: false,
    max_shifts_per_week: null,
    max_hours_per_week: null,
    notes: null,
  };

  return (
    <div className="space-y-10 p-4 max-w-lg mx-auto pb-16">
      {msg ? <p className="text-sm text-destructive">{msg}</p> : null}

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Work style
        </h2>
        <form
          className="space-y-3 border rounded-lg p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(async () =>
              upsertEmployeeWorkPreferences({
                employeeId,
                wants_extra_hours: fd.has("wants_extra_hours"),
                open_to_same_day_coverage: fd.has("open_to_same_day_coverage"),
                open_to_weekend_shifts: fd.has("open_to_weekend_shifts"),
                prefers_consistent_schedule: fd.has("prefers_consistent_schedule"),
                max_shifts_per_week: fd.get("max_shifts_per_week")
                  ? parseInt(String(fd.get("max_shifts_per_week")), 10)
                  : null,
                max_hours_per_week: fd.get("max_hours_per_week")
                  ? Number(String(fd.get("max_hours_per_week")))
                  : null,
                notes: String(fd.get("notes") ?? "") || null,
              })
            );
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="wants_extra_hours" defaultChecked={w.wants_extra_hours} />
            Wants extra hours
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="open_to_same_day_coverage"
              defaultChecked={w.open_to_same_day_coverage}
            />
            Open to same-day coverage
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="open_to_weekend_shifts"
              defaultChecked={w.open_to_weekend_shifts}
            />
            Open to weekend shifts
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="prefers_consistent_schedule"
              defaultChecked={w.prefers_consistent_schedule}
            />
            Prefers consistent schedule
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Max shifts / week</Label>
              <Input
                name="max_shifts_per_week"
                type="number"
                min={0}
                defaultValue={w.max_shifts_per_week ?? ""}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label className="text-xs">Max hours / week</Label>
              <Input
                name="max_hours_per_week"
                type="number"
                min={0}
                step={0.5}
                defaultValue={w.max_hours_per_week ?? ""}
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input name="notes" defaultValue={w.notes ?? ""} placeholder="Optional" />
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            Save work preferences
          </Button>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Task categories
        </h2>
        <p className="text-xs text-muted-foreground mb-2">
          Use stable keys aligned with checklist task keys. Prefer your taxonomy so labels stay readable.
        </p>
        <div className="space-y-4 mb-4">
          {groupedTaskPrefs.map(([heading, prefs]) => (
            <div key={heading}>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {heading}
              </p>
              <ul className="space-y-2">
                {prefs.map((t) => {
                  const taxLabel = getTaskKeyDisplayLabel(t.preference_key, taxonomy);
                  const showTax = taxLabel !== t.preference_key;
                  return (
                    <li
                      key={t.preference_key}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm border rounded-md px-3 py-2"
                    >
                      <span>
                        {showTax ? (
                          <>
                            <span className="font-medium">{taxLabel}</span>
                            <span className="text-muted-foreground text-xs font-mono ml-1">
                              · {t.preference_key}
                            </span>
                          </>
                        ) : (
                          <span className="font-medium font-mono text-xs">{t.preference_key}</span>
                        )}
                        {" · "}
                        {t.preference_level}
                        {t.preference_label && !showTax ? (
                          <span className="text-muted-foreground"> — {t.preference_label}</span>
                        ) : null}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(async () => deleteEmployeeTaskPreference(employeeId, t.preference_key))
                        }
                      >
                        Remove
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <AddTaskPrefForm
          employeeId={employeeId}
          disabled={pending}
          taxonomy={taxonomy}
          onAdd={(p) => run(async () => upsertEmployeeTaskPreference(p))}
        />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Schedule patterns
        </h2>
        <ul className="space-y-2 mb-4">
          {schedulePrefs.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm border rounded-md px-3 py-2"
            >
              <span>
                {s.weekday !== null ? WEEKDAY_LABEL[s.weekday] : "Any day"}{" "}
                {s.shift_type ? `· ${s.shift_type}` : ""} · {s.preference_level}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(async () => deleteEmployeeSchedulePreference(s.id))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <AddSchedulePrefForm
          employeeId={employeeId}
          disabled={pending}
          onAdd={(p) => run(async () => upsertEmployeeSchedulePreference(p))}
        />
      </section>
    </div>
  );
}

function AddTaskPrefForm({
  employeeId,
  disabled,
  taxonomy,
  onAdd,
}: {
  employeeId: string;
  disabled: boolean;
  taxonomy: TaxonomyRow[];
  onAdd: (p: {
    employeeId: string;
    preferenceKey: string;
    preferenceLabel?: string | null;
    preferenceLevel: "prefer" | "neutral" | "avoid";
  }) => void;
}) {
  const [pick, setPick] = useState("");
  const [custom, setCustom] = useState("");
  const [label, setLabel] = useState("");
  const [level, setLevel] = useState<"prefer" | "neutral" | "avoid">("neutral");
  const activeTax = taxonomy.filter((t) => t.is_active !== false);

  return (
    <div className="border border-dashed rounded-lg p-3 space-y-2">
      {activeTax.length > 0 ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">From taxonomy</Label>
          <select
            className="w-full border rounded-md px-2 py-2 text-sm bg-background h-10"
            value={pick}
            onChange={(e) => {
              setPick(e.target.value);
              if (e.target.value) setCustom("");
            }}
          >
            <option value="">Choose category…</option>
            {activeTax.map((t) => (
              <option key={t.task_key} value={t.task_key}>
                {t.display_label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Custom key (optional)</Label>
        <Input
          placeholder="Normalized key if not in list above"
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            if (e.target.value.trim()) setPick("");
          }}
          className="font-mono text-sm"
        />
      </div>
      <Input placeholder="Notes (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
      <select
        className="w-full border rounded-md px-2 py-2 text-sm bg-background h-10"
        value={level}
        onChange={(e) => setLevel(e.target.value as "prefer" | "neutral" | "avoid")}
      >
        <option value="prefer">Prefer</option>
        <option value="neutral">Neutral</option>
        <option value="avoid">Avoid</option>
      </select>
      <Button
        type="button"
        size="sm"
        disabled={disabled || !(custom.trim() || pick.trim())}
        onClick={() => {
          const preferenceKey = (custom.trim() || pick).trim();
          onAdd({
            employeeId,
            preferenceKey,
            preferenceLabel: label.trim() || null,
            preferenceLevel: level,
          });
          setPick("");
          setCustom("");
          setLabel("");
        }}
      >
        Add task preference
      </Button>
    </div>
  );
}

function AddSchedulePrefForm({
  employeeId,
  disabled,
  onAdd,
}: {
  employeeId: string;
  disabled: boolean;
  onAdd: (p: {
    employeeId: string;
    weekday: number | null;
    shiftType: string | null;
    preferenceLevel: "prefer" | "available" | "avoid" | "unavailable";
  }) => void;
}) {
  const [weekday, setWeekday] = useState<string>(""); // "" = any
  const [shiftType, setShiftType] = useState<string>(""); // "" = any
  const [level, setLevel] = useState<"prefer" | "available" | "avoid" | "unavailable">("available");

  return (
    <div className="border border-dashed rounded-lg p-3 space-y-2">
      <select
        className="w-full border rounded-md px-2 py-2 text-sm bg-background h-10"
        value={weekday}
        onChange={(e) => setWeekday(e.target.value)}
      >
        <option value="">Any weekday</option>
        {WEEKDAY_LABEL.map((d, i) => (
          <option key={d} value={String(i)}>
            {d}
          </option>
        ))}
      </select>
      <select
        className="w-full border rounded-md px-2 py-2 text-sm bg-background h-10"
        value={shiftType}
        onChange={(e) => setShiftType(e.target.value)}
      >
        <option value="">Any shift type</option>
        {SHIFT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        className="w-full border rounded-md px-2 py-2 text-sm bg-background h-10"
        value={level}
        onChange={(e) =>
          setLevel(e.target.value as "prefer" | "available" | "avoid" | "unavailable")
        }
      >
        <option value="prefer">Prefer</option>
        <option value="available">Available</option>
        <option value="avoid">Avoid</option>
        <option value="unavailable">Unavailable</option>
      </select>
      <Button
        type="button"
        size="sm"
        disabled={disabled || (!weekday && !shiftType)}
        onClick={() =>
          onAdd({
            employeeId,
            weekday: weekday === "" ? null : parseInt(weekday, 10),
            shiftType: shiftType === "" ? null : shiftType,
            preferenceLevel: level,
          })
        }
      >
        Add schedule preference
      </Button>
    </div>
  );
}
