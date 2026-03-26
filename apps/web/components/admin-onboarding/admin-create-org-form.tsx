"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminCreateOrgWithOwner } from "@/app/platform-admin/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STARTER_PACKS } from "@/lib/onboarding/starter-packs";
import { ADMIN_ONBOARDING_BASE_PATH } from "@/lib/admin-onboarding/constants";

export function AdminCreateOrgForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4 rounded-lg border border-border p-4 max-w-lg"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(() => {
          void (async () => {
            const r = await adminCreateOrgWithOwner(new FormData(e.currentTarget));
            if ("error" in r && r.error) setError(r.error);
            else if ("organizationId" in r && r.organizationId) {
              router.push(`${ADMIN_ONBOARDING_BASE_PATH}/${r.organizationId}`);
              router.refresh();
            }
          })();
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Organization name *</Label>
        <Input id="name" name="name" required placeholder="Acme Co" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="owner_user_id">Owner user id (auth.users.id) *</Label>
        <Input id="owner_user_id" name="owner_user_id" required placeholder="uuid" className="font-mono text-xs" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="idempotency_key">Idempotency key (optional)</Label>
        <Input
          id="idempotency_key"
          name="idempotency_key"
          placeholder="e.g. sales-deal-2025-03-acme"
          className="font-mono text-xs"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry">Industry</Label>
        <select
          id="industry"
          name="industry"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          defaultValue="general"
        >
          {Object.keys(STARTER_PACKS).map((k) => (
            <option key={k} value={k}>
              {STARTER_PACKS[k]?.displayName ?? k}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="plan_key">Plan key (optional)</Label>
        <Input id="plan_key" name="plan_key" placeholder="growth, pilot, …" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create org (full provision)"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Calls <code className="font-mono">provisionOrganization</code> — not raw inserts.
      </p>
    </form>
  );
}
