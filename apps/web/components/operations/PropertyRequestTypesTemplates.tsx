import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export async function PropertyRequestTypesTemplates({ propertyId }: { propertyId: string }) {
  const admin = createServiceRoleClient();
  const { data: property } = await admin.from("properties").select("name, timezone").eq("id", propertyId).single();

  const { data: requestTypes } = await admin
    .from("request_types")
    .select("id, code, label, department, default_priority, default_sla_minutes, is_active")
    .eq("property_id", propertyId)
    .order("code");

  const rows = requestTypes ?? [];

  return (
    <div className="min-h-full">
      <header className="border-b border-border/60 bg-[var(--app-bg)]/90 backdrop-blur-md px-6 py-6 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between max-w-3xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Property templates
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{property?.name ?? "Property"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Request types become tasks when guests scan a QR. Edit codes and SLAs in property admin.
            </p>
          </div>
          <Button asChild className="gap-2 shrink-0">
            <Link href="/app/admin/property">
              <Pencil className="h-4 w-4" />
              Edit in property admin
            </Link>
          </Button>
        </div>
      </header>

      <div className="p-6 md:p-8 max-w-3xl space-y-6">
        <Card className="border-border/60 shadow-sm border-l-4 border-l-primary/40">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ClipboardList className="h-4 w-4 text-primary" />
              Property metadata
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>
              <span className="font-medium text-foreground">Timezone:</span> {property?.timezone ?? "—"}
            </p>
          </CardContent>
        </Card>

        <section aria-labelledby="templates-heading" className="space-y-3">
          <h2 id="templates-heading" className="text-sm font-semibold text-foreground">
            Templates ({rows.length})
          </h2>
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
              No templates yet. Add request types under property admin.
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((rt) => (
                <li key={rt.id}>
                  <Card
                    className={cn(
                      "border-border/60 shadow-sm transition hover:border-primary/15",
                      !rt.is_active && "opacity-60"
                    )}
                  >
                    <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">{rt.label}</span>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {rt.code}
                          </code>
                          {!rt.is_active && <Badge variant="muted">Inactive</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {rt.department ?? "General"} · SLA {rt.default_sla_minutes} min · priority{" "}
                          {rt.default_priority}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
