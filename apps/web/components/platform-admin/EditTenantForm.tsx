"use client";

import { useState } from "react";
import { updateTenant } from "@/app/platform-admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tenant = {
  name: string;
  billing_name: string | null;
  billing_email: string | null;
  billing_address: string | null;
};

export function EditTenantForm({
  tenantId,
  tenant,
}: {
  tenantId: string;
  tenant: Tenant;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(tenant.name);
  const [billing_name, setBillingName] = useState(tenant.billing_name ?? "");
  const [billing_email, setBillingEmail] = useState(tenant.billing_email ?? "");
  const [billing_address, setBillingAddress] = useState(tenant.billing_address ?? "");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    formData.set("name", name);
    formData.set("billing_name", billing_name);
    formData.set("billing_email", billing_email);
    formData.set("billing_address", billing_address);
    const result = await updateTenant(tenantId, formData);
    setLoading(false);
    if (result?.error) setError(result.error);
    if (result?.ok) window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Company / customer name *</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="logo">Logo (optional, upload to replace)</Label>
        <Input id="logo" name="logo" type="file" accept="image/*" className="cursor-pointer" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="billing_name">Billing contact name</Label>
        <Input
          id="billing_name"
          name="billing_name"
          value={billing_name}
          onChange={(e) => setBillingName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="billing_email">Billing email</Label>
        <Input
          id="billing_email"
          name="billing_email"
          type="email"
          value={billing_email}
          onChange={(e) => setBillingEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="billing_address">Billing address</Label>
        <Input
          id="billing_address"
          name="billing_address"
          value={billing_address}
          onChange={(e) => setBillingAddress(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
