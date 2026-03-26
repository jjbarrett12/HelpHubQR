import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Image from "next/image";

export default async function PlatformAdminPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, logo_url, billing_email, billing_name, created_at")
    .order("name");

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Customers (tenants)</h1>
        <Link href="/platform-admin/tenants/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add customer
          </Button>
        </Link>
      </div>
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Billing</th>
              <th className="text-left p-3 font-medium">Created</th>
              <th className="w-0 p-3" />
            </tr>
          </thead>
          <tbody>
            {(tenants ?? []).map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {t.logo_url ? (
                      <Image src={t.logo_url} alt="" width={32} height={32} className="rounded object-contain bg-muted" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium">
                        {t.name.slice(0, 1)}
                      </div>
                    )}
                    <span className="font-medium">{t.name}</span>
                  </div>
                </td>
                <td className="p-3 text-muted-foreground">
                  {t.billing_email || t.billing_name || "—"}
                </td>
                <td className="p-3 text-muted-foreground">
                  {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                </td>
                <td className="p-3 text-right">
                  <Link href={`/platform-admin/tenants/${t.id}`}>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!tenants || tenants.length === 0) && (
          <p className="p-6 text-center text-muted-foreground">No customers yet. Add one to get started.</p>
        )}
      </div>
    </div>
  );
}
