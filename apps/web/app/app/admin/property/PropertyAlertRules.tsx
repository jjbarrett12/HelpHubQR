"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addPropertyAlertRule, deletePropertyAlertRule } from "./actions";

type Rule = { id: string; channel: string; target: string; enabled: boolean };

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Adding…" : "Add"}
    </Button>
  );
}

export function PropertyAlertRules({ rules }: { rules: Rule[] }) {
  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-2 font-medium text-foreground">SLA breach alerts</h2>
      <p className="text-sm text-muted-foreground mb-3">
        When tasks go overdue, these recipients get an email or SMS. Call the <code className="text-xs">check-sla</code> Edge Function every 10–15 min (e.g. Vercel Cron) to send alerts.
      </p>
      <form action={async (fd) => { await addPropertyAlertRule(fd); }} className="flex flex-wrap items-end gap-2 mb-4">
        <div className="space-y-1">
          <Label htmlFor="channel" className="text-xs">Channel</Label>
          <Select name="channel" required>
            <SelectTrigger id="channel" className="w-[100px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="target" className="text-xs">Email or phone</Label>
          <Input
            id="target"
            name="target"
            type="text"
            placeholder="email@example.com or +1..."
            className="w-[200px]"
            required
          />
        </div>
        <AddButton />
      </form>
      <ul className="space-y-1 text-sm">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 py-1">
            <span>
              <span className="font-medium">{r.channel}</span> – {r.target}
            </span>
            <form action={async (fd) => { await deletePropertyAlertRule(fd); }}>
              <input type="hidden" name="ruleId" value={r.id} />
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                Remove
              </Button>
            </form>
          </li>
        ))}
        {rules.length === 0 && (
          <li className="text-muted-foreground py-1">No alert recipients yet. Add one above.</li>
        )}
      </ul>
    </section>
  );
}
