"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createChecklistRunForShift, markRunSent } from "@/app/app/helphub/actions/shifts";
import { publicChecklistUrl } from "@/lib/helphub/app-url";
import { RunDeliveryActions } from "@/components/helphub/RunDeliveryActions";
import type { DeliveryChannelHint } from "@/lib/delivery/delivery-status";

type Props = {
  shiftId: string;
  run?: {
    id: string;
    access_token: string;
    status: string;
  } | null;
  deliveryHints?: DeliveryChannelHint[];
};

export function ShiftQuickActions({ shiftId, run, deliveryHints = [] }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const url = run?.access_token ? publicChecklistUrl(run.access_token) : "";

  return (
    <div className="flex flex-col gap-2 items-start">
      {!run ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setMsg(null);
            startTransition(async () => {
              const res = await createChecklistRunForShift(shiftId);
              if ("error" in res && res.error) setMsg(res.error);
              else router.refresh();
            });
          }}
        >
          Generate checklist run
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !url}
            onClick={async () => {
              if (!url) return;
              try {
                await navigator.clipboard.writeText(url);
                setMsg("Link copied");
              } catch {
                setMsg("Copy failed — select the link manually");
              }
            }}
          >
            Copy link
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending || run.status === "sent" || run.status === "opened" || run.status === "completed"}
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                const res = await markRunSent(run.id);
                if ("error" in res && res.error) setMsg(res.error);
                else router.refresh();
              });
            }}
          >
            Mark sent
          </Button>
        </div>
      )}
      {run && deliveryHints.length > 0 ? (
        <RunDeliveryActions runId={run.id} hints={deliveryHints} />
      ) : null}
      {url ? (
        <p className="text-[11px] text-muted-foreground break-all max-w-[280px]">{url}</p>
      ) : null}
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
