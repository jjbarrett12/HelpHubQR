"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTenant } from "@/app/platform-admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CreateTenantForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [billing_name, setBillingName] = useState("");
  const [billing_email, setBillingEmail] = useState("");
  const [billing_address, setBillingAddress] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    formData.set("name", name);
    formData.set("billing_name", billing_name);
    formData.set("billing_email", billing_email);
    formData.set("billing_address", billing_address);
    const result = await createTenant(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (result?.ok && result.tenantId) {
      router.push(`/platform-admin/tenants/${result.tenantId}`);
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New customer (tenant)</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company / customer name *</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Cleaning Co"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Logo (optional)</Label>
            <Input id="logo" name="logo" type="file" accept="image/*" className="cursor-pointer" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_name">Billing contact name</Label>
            <Input
              id="billing_name"
              name="billing_name"
              value={billing_name}
              onChange={(e) => setBillingName(e.target.value)}
              placeholder="John Smith"
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
              placeholder="billing@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_address">Billing address</Label>
            <Input
              id="billing_address"
              name="billing_address"
              value={billing_address}
              onChange={(e) => setBillingAddress(e.target.value)}
              placeholder="123 Main St, City, State ZIP"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create customer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
