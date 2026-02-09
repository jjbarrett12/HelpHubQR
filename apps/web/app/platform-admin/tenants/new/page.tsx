import Link from "next/link";
import { CreateTenantForm } from "@/components/platform-admin/CreateTenantForm";

export default function NewTenantPage() {
  return (
    <div className="max-w-xl">
      <nav className="text-sm text-muted-foreground mb-4">
        <Link href="/platform-admin" className="hover:text-foreground">Customers</Link>
        <span className="mx-1">/</span>
        <span className="text-foreground font-medium">Add customer</span>
      </nav>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Add customer</h1>
      <CreateTenantForm />
    </div>
  );
}
