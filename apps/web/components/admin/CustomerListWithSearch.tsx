"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Building2, LayoutGrid, List, Rows3, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DeleteCustomerButton } from "./DeleteCustomerButton";

type SiteRow = {
  id: string;
  name: string;
  address?: string | null;
  logo_url?: string | null;
  room_count?: number | null;
  created_at?: string;
  archived_at?: string | null;
};

type ViewMode = "list" | "tile" | "compact";

function CustomerActions({
  site,
  showLabels = true,
  size = "sm",
}: {
  site: SiteRow;
  showLabels?: boolean;
  size?: "sm" | "icon";
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button variant="outline" size={size} asChild>
        <Link href={`/app/admin/rooms?siteId=${site.id}`}>
          {showLabels ? "Locations & QR" : "QR"}
        </Link>
      </Button>
      <Button size={size} asChild>
        <Link href={`/app/sites/${site.id}`}>
          {showLabels ? "Dashboard" : "Open"}
        </Link>
      </Button>
      <DeleteCustomerButton siteId={site.id} customerName={site.name} />
    </div>
  );
}

export function CustomerListWithSearch({ sites }: { sites: SiteRow[] }) {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("tile");

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? sites.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.address ?? "").toLowerCase().includes(q)
        )
      : [...sites];
    return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [sites, query]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search customers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Search customers"
          />
        </div>
        <div className="flex rounded-md border border-input bg-muted/30 p-0.5" role="tablist" aria-label="View mode">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded",
              viewMode === "list" && "bg-background shadow-sm"
            )}
            onClick={() => setViewMode("list")}
            aria-label="List view"
            aria-pressed={viewMode === "list"}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded",
              viewMode === "tile" && "bg-background shadow-sm"
            )}
            onClick={() => setViewMode("tile")}
            aria-label="Tile view"
            aria-pressed={viewMode === "tile"}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 rounded",
              viewMode === "compact" && "bg-background shadow-sm"
            )}
            onClick={() => setViewMode("compact")}
            aria-label="Compact view"
            aria-pressed={viewMode === "compact"}
          >
            <Rows3 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === "list" && (
        <div className="rounded-lg border border-border overflow-hidden">
          <ul className="divide-y divide-border">
            {filteredAndSorted.map((site) => (
              <li
                key={site.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {site.logo_url ? (
                    <img
                      src={site.logo_url}
                      alt=""
                      className="h-9 w-auto object-contain shrink-0"
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-medium">{site.name}</span>
                    {site.archived_at && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Archived
                      </Badge>
                    )}
                    {site.address && (
                      <span className="text-muted-foreground ml-2">— {site.address}</span>
                    )}
                    {site.room_count != null && (
                      <span className="text-muted-foreground text-xs ml-2">
                        ({site.room_count} locations)
                      </span>
                    )}
                  </div>
                </div>
                <CustomerActions site={site} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {viewMode === "tile" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSorted.map((site) => (
            <Card
              key={site.id}
              className="border-card-border border-l-4 border-l-accent-border/50 shadow-sm flex flex-col"
            >
              <CardHeader className="flex flex-col items-stretch gap-3">
                <div className="flex items-start gap-3">
                  {site.logo_url ? (
                    <img
                      src={site.logo_url}
                      alt=""
                      className="h-10 w-auto object-contain shrink-0"
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="font-medium truncate">{site.name}</h2>
                      {site.archived_at && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          Archived
                        </Badge>
                      )}
                    </div>
                    {site.address && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{site.address}</p>
                    )}
                    {site.room_count != null && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {site.room_count} locations
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CustomerActions site={site} />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {viewMode === "compact" && (
        <div className="rounded-lg border border-border overflow-hidden">
          <ul className="divide-y divide-border">
            {filteredAndSorted.map((site) => (
              <li
                key={site.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {site.logo_url ? (
                    <img
                      src={site.logo_url}
                      alt=""
                      className="h-6 w-auto object-contain shrink-0"
                    />
                  ) : (
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium truncate">{site.name}</span>
                  {site.archived_at && (
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      Archived
                    </Badge>
                  )}
                  {site.room_count != null && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {site.room_count} loc
                    </span>
                  )}
                </div>
                <CustomerActions site={site} showLabels={false} size="sm" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {filteredAndSorted.length === 0 && (
        <Card className="border-card-border border border-dashed">
          <CardContent className="py-12 px-6 text-center">
            <p className="font-medium text-foreground">
              {sites.length === 0
                ? "No customers yet"
                : "No customers match your search"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {sites.length === 0
                ? "Add a customer (site) above to create rooms and QR codes, then view tickets from the dashboard."
                : "Try a different search term."}
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
