"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  claimOpenShift,
  proposeShiftTrade,
  requestShiftCoverage,
} from "@/app/app/helphub/actions/workforce-employee";

export type MyShiftRow = {
  id: string;
  shift_date: string;
  shift_type: string;
  location_name: string | null;
  role_name: string;
  is_open_for_claim: boolean;
};

type Coworker = { id: string; full_name: string };

type Props = {
  myShifts: MyShiftRow[];
  openShifts: MyShiftRow[];
  coworkers: Coworker[];
};

export function EmployeeMyShiftsClient({ myShifts, openShifts, coworkers }: Props) {
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

  return (
    <div className="space-y-8 p-4 max-w-lg mx-auto">
      {msg ? (
        <p className="text-sm text-destructive border border-destructive/30 rounded-md px-3 py-2">{msg}</p>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          My upcoming shifts
        </h2>
        {myShifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shifts scheduled from today onward.</p>
        ) : (
          <ul className="space-y-3">
            {myShifts.map((s) => (
              <li key={s.id} className="border rounded-lg p-4 space-y-3 bg-card">
                <div className="text-sm">
                  <p className="font-medium">
                    {s.shift_date} · {s.shift_type}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {s.role_name}
                    {s.location_name ? ` · ${s.location_name}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={pending}
                  onClick={() =>
                    run(async () => requestShiftCoverage({ shiftId: s.id }))
                  }
                >
                  Request coverage (open claim)
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Open shifts you can claim
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          You must be eligible (role and location). Manager approval may apply.
        </p>
        {openShifts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open shifts right now.</p>
        ) : (
          <ul className="space-y-3">
            {openShifts.map((s) => (
              <li key={s.id} className="border rounded-lg p-4 flex flex-wrap items-center justify-between gap-2 bg-card">
                <div className="text-sm">
                  <p className="font-medium">
                    {s.shift_date} · {s.shift_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.role_name}
                    {s.location_name ? ` · ${s.location_name}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(async () => claimOpenShift(s.id))}
                >
                  Claim
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Offer a shift (trade / handoff)
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Sends a trade request. If you pick a coworker, only they can accept (unless you leave
          target open for eligible staff).
        </p>
        <TradeOfferForm myShifts={myShifts} coworkers={coworkers} disabled={pending} />
      </section>
    </div>
  );
}

function TradeOfferForm({
  myShifts,
  coworkers,
  disabled,
}: {
  myShifts: MyShiftRow[];
  coworkers: Coworker[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [shiftId, setShiftId] = useState(myShifts[0]?.id ?? "");
  const [targetId, setTargetId] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (myShifts.length === 0) {
    return <p className="text-sm text-muted-foreground">Schedule a shift first.</p>;
  }

  return (
    <form
      className="space-y-3 border rounded-lg p-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        setMsg(null);
        startTransition(async () => {
          const res = await proposeShiftTrade({
            offeredShiftId: shiftId,
            targetEmployeeId: targetId || null,
            reason: reason || undefined,
          });
          if ("error" in res && res.error) setMsg(res.error);
          else router.refresh();
        });
      }}
    >
      <div className="space-y-1">
        <Label className="text-xs">Your shift</Label>
        <select
          className="w-full border rounded-md px-2 py-2 text-sm bg-background h-10"
          value={shiftId}
          onChange={(e) => setShiftId(e.target.value)}
          disabled={disabled || pending}
        >
          {myShifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.shift_date} · {s.shift_type}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Offer to specific coworker (optional)</Label>
        <select
          className="w-full border rounded-md px-2 py-2 text-sm bg-background h-10"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          disabled={disabled || pending}
        >
          <option value="">Open to eligible staff</option>
          {coworkers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Note</Label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional message"
          disabled={disabled || pending}
        />
      </div>
      {msg ? (
        <p className="text-sm text-destructive">{msg}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={disabled || pending || !shiftId}>
        Propose trade
      </Button>
    </form>
  );
}
