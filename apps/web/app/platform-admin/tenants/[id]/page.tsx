import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getTenantWithUserEmails } from "@/lib/platform-admin";
import { EditTenantForm } from "@/components/platform-admin/EditTenantForm";
import { TenantUserList } from "@/components/platform-admin/TenantUserList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getTenantWithUserEmails(id);
  if (!data) redirect("/platform-admin");

  return (
    <div className="max-w-3xl space-y-8">
      <nav className="text-sm text-muted-foreground">
        <Link href="/platform-admin" className="hover:text-foreground">Customers</Link>
        <span className="mx-1">/</span>
        <span className="text-foreground font-medium">{data.name}</span>
      </nav>

      <div className="flex items-start gap-6 flex-wrap">
        {data.logo_url ? (
          <Image
            src={data.logo_url}
            alt={data.name}
            width={80}
            height={80}
            className="rounded-lg object-contain border border-border bg-muted"
          />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-muted border border-border flex items-center justify-center text-2xl font-semibold text-muted-foreground">
            {data.name.slice(0, 1)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
          {data.billing_email && (
            <p className="text-muted-foreground text-sm mt-1">Billing: {data.billing_email}</p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
        </CardHeader>
        <CardContent>
          <EditTenantForm tenantId={id} tenant={data} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <p className="text-sm text-muted-foreground">Manage emails and passwords for this customer.</p>
        </CardHeader>
        <CardContent>
          <TenantUserList
            tenantId={id}
            profiles={data.profiles}
            userEmails={data.userEmails}
          />
        </CardContent>
      </Card>
    </div>
  );
}
