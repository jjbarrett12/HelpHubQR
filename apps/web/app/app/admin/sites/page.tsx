import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CreateSiteForm } from "@/components/admin/CreateSiteForm";
import { CustomerListWithSearch } from "@/components/admin/CustomerListWithSearch";

export default async function AdminSitesPage() {
  const supabase = await createClient();
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, address, logo_url, room_count, created_at, archived_at")
    .order("name");

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <nav className="text-sm text-muted-foreground mb-1" aria-label="Breadcrumb">
            <Link href="/app" className="hover:text-foreground">Dashboard</Link>
            <span className="mx-1">/</span>
            <span className="text-foreground font-medium">Customers</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        </div>
        <CreateSiteForm />
      </div>
      <CustomerListWithSearch sites={sites ?? []} />
    </div>
  );
}
