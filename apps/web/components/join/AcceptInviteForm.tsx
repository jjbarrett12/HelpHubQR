"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acceptTenantInviteAction } from "@/app/join/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AcceptInviteForm({ isAuthed }: { isAuthed: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inFlight = useRef(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (inFlight.current || pending) return;
    inFlight.current = true;
    start(async () => {
      try {
        const r = await acceptTenantInviteAction(token);
        if (!r.ok) {
          setErr(r.error);
          return;
        }
        router.push("/app/admin/sites?joined=1");
        router.refresh();
      } finally {
        inFlight.current = false;
      }
    });
  }

  if (!isAuthed) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 space-y-4 max-w-md">
        <p className="text-sm text-muted-foreground">
          Sign in with the <strong>same email address</strong> the invite was sent to, then return here and paste your invite code.
        </p>
        <Button asChild className="w-full">
          <Link href="/login?next=/join">Sign in to continue</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-border bg-card p-6 space-y-4 max-w-md w-full">
      <div className="space-y-2">
        <Label htmlFor="invite-token">Invite code</Label>
        <Input
          id="invite-token"
          name="token"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste the one-time code from your admin"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          This adds you to the tenant account (sites, rooms, tickets). HelpHub organizations are separate — create or join an org from the app bar if you use shift checklists.
        </p>
      </div>
      {err && (
        <p className="text-sm text-destructive" role="alert">
          {err}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending || !token.trim()}>
        {pending ? "Accepting…" : "Accept invite"}
      </Button>
    </form>
  );
}
