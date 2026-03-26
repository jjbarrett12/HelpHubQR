"use client";

import { useState, useTransition } from "react";
import { createTenantInviteForCustomer } from "@/app/platform-admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TenantInviteForm({ tenantId }: { tenantId: string }) {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "staff">("staff");
  const [token, setToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <p className="text-sm font-medium">Invite user (email)</p>
      <p className="text-xs text-muted-foreground">
        Creates a pending invite. Copy the token once — it is not stored in plaintext. Recipient signs in with the same email, opens{" "}
        <code className="text-[10px]">/join</code>, and pastes the code (customer sites and tickets — separate from HelpHub organizations).
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          setToken(null);
          start(async () => {
            const r = await createTenantInviteForCustomer(tenantId, email, role);
            if ("error" in r && r.error) setErr(r.error);
            else if ("token" in r && r.token) setToken(r.token);
          });
        }}
      >
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-9 w-56" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Role</Label>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="staff">staff</option>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          Create invite
        </Button>
      </form>
      {err && <p className="text-xs text-destructive">{err}</p>}
      {token && (
        <div className="rounded bg-muted p-2 text-xs font-mono break-all">
          <span className="text-muted-foreground block mb-1">One-time invite token (copy now):</span>
          {token}
        </div>
      )}
    </div>
  );
}
