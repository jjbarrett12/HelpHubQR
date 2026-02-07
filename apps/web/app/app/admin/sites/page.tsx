import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Plus, Building2 } from "lucide-react";
import { CreateSiteForm } from "@/components/admin/CreateSiteForm";

export default async function AdminSitesPage() {
  const supabase = await createClient();
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, address, logo_url, room_count, created_at")
    .order("name");

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <CreateSiteForm />
      </div>
      <div className="grid gap-4">
        {sites?.map((site) => (
          <Card key={site.id} className="border-card-border border-l-4 border-l-accent-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                {(site as { logo_url?: string }).logo_url ? (
                  <img
                    src={(site as { logo_url: string }).logo_url}
                    alt=""
                    className="h-10 w-auto object-contain"
                  />
                ) : (
                  <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <div>
                  <h2 className="font-medium">{site.name}</h2>
                  {site.address && (
                    <p className="text-sm text-muted-foreground">{site.address}</p>
                  )}
                  {(site as { room_count?: number }).room_count != null && (
                    <p className="text-xs text-muted-foreground">
                      {(site as { room_count: number }).room_count} locations
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/app/admin/rooms?siteId=${site.id}`}>
                    Locations & QR
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={`/app/sites/${site.id}`}>Dashboard</Link>
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
        {(!sites || sites.length === 0) && (
          <Card className="border-card-border border border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              No customers yet. Add one to get started.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
