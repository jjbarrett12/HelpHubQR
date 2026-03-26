"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sendChecklistDeliveries } from "@/app/app/helphub/actions/delivery";

type ChannelHint = {
  channel: "sms" | "email";
  label: string;
  actionable?: string;
};

export function RunDeliveryActions({
  runId,
  hints,
}: {
  runId: string;
  hints: ChannelHint[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function formatResults(text: string) {
    setMsg(text);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 items-stretch w-full sm:w-auto min-w-[140px]">
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const res = await sendChecklistDeliveries(runId, false);
              if ("error" in res && res.error) {
                setMsg(res.error);
                return;
              }
              if (!("ok" in res) || !res.ok || !res.results) {
                setMsg("Unexpected response");
                return;
              }
              const parts = res.results.map(
                (r) => `${r.channel}: ${r.outcome}${r.reason ? ` (${r.reason})` : ""}`
              );
              formatResults(parts.join(" · "));
            });
          }}
        >
          Send
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const res = await sendChecklistDeliveries(runId, true);
              if ("error" in res && res.error) {
                setMsg(res.error);
                return;
              }
              if (!("ok" in res) || !res.ok || !res.results) {
                setMsg("Unexpected response");
                return;
              }
              const parts = res.results.map(
                (r) => `${r.channel}: ${r.outcome}${r.reason ? ` (${r.reason})` : ""}`
              );
              formatResults(parts.join(" · "));
            });
          }}
        >
          Resend
        </Button>
      </div>
      {hints.length > 0 ? (
        <ul className="text-[11px] text-muted-foreground space-y-0.5">
          {hints.map((h) => (
            <li key={h.channel}>
              <span className="font-medium text-foreground/90">{h.label}:</span>{" "}
              {h.actionable ?? "OK"}
            </li>
          ))}
        </ul>
      ) : null}
      {msg ? <p className="text-[11px] text-muted-foreground break-words">{msg}</p> : null}
    </div>
  );
}
