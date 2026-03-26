"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrganizationDeliverySettings } from "@/app/app/helphub/actions/delivery";
import type { OrgDeliverySettings } from "@/lib/delivery/checklist-delivery";

export function DeliverySettingsForm({ initial }: { initial: OrgDeliverySettings }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-3 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Cron automation</strong> calls{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">POST /api/cron/checklist-delivery</code> with header{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">x-cron-secret</code> or{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization: Bearer …</code>. Set{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">CRON_SECRET</code> and{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">CRON_SCHEDULE_TZ</code> (IANA zone, e.g. America/New_York).
        </p>
        <p>
          <strong className="text-foreground">Twilio</strong> requires{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">TWILIO_ACCOUNT_SID</code>,{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">TWILIO_AUTH_TOKEN</code>, and a default{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">TWILIO_FROM_NUMBER</code> unless you set a from number
          below.
        </p>
        <p>
          <strong className="text-foreground">Email</strong> uses{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">RESEND_API_KEY</code> or{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">SENDGRID_API_KEY</code> plus{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">CHECKLIST_FROM_EMAIL</code> (or{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">ALERT_FROM_EMAIL</code>).
        </p>
      </div>

      <form
        className="space-y-6"
        action={(fd) => {
          setMessage(null);
          startTransition(async () => {
            const res = await updateOrganizationDeliverySettings(fd);
            if ("error" in res && res.error) setMessage(res.error);
            else setMessage("Saved.");
          });
        }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="send_sms"
              name="send_sms"
              defaultChecked={initial.send_sms}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="send_sms" className="font-medium text-foreground cursor-pointer">
              Send checklist link by SMS
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="send_email"
              name="send_email"
              defaultChecked={initial.send_email}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="send_email" className="font-medium text-foreground cursor-pointer">
              Send checklist link by email
            </Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="default_send_offset_minutes">Default send offset (minutes after shift start)</Label>
          <Input
            id="default_send_offset_minutes"
            name="default_send_offset_minutes"
            type="number"
            min={0}
            max={1440}
            defaultValue={initial.default_send_offset_minutes}
            className="max-w-xs bg-background/80"
          />
          <p className="text-xs text-muted-foreground">
            Cron only sends when the current time is at or after the shift&apos;s start time (or midnight on the shift date
            if no start time is set) plus this many minutes.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sms_from_number">SMS from number (E.164, optional)</Label>
          <Input
            id="sms_from_number"
            name="sms_from_number"
            type="text"
            placeholder="+15551234567"
            defaultValue={initial.sms_from_number ?? ""}
            className="max-w-md bg-background/80"
          />
          <p className="text-xs text-muted-foreground">Overrides TWILIO_FROM_NUMBER for this organization when set.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reply_to_email">Reply-to email (optional)</Label>
          <Input
            id="reply_to_email"
            name="reply_to_email"
            type="email"
            placeholder="manager@hotel.com"
            defaultValue={initial.reply_to_email ?? ""}
            className="max-w-md bg-background/80"
          />
        </div>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {message ? (
          <p className={`text-sm ${message === "Saved." ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
