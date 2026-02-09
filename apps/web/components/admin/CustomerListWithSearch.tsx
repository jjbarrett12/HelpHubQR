"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Building2, Search } from "lucide-react";

type SiteRow = {
  id: string;
  name: string;
  address?: string | null;
  logo_url?: string | null;
  room_count?: number | null;
  created_at?: string;
};

export function CustomerListWithSearch({ sites }: { sites: SiteRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.address ?? "").toLowerCase().includes(q)
    );
  }, [sites, query]);

  return (
    <>
      <div className="mb-4">
        <div className="relative max-w-sm">
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
      </div>
      <div className="grid gap-4">
        {filtered.map((site) => (
          <Card
            key={site.id}
            className="border-card-border border-l-4 border-l-accent-border/50 shadow-sm"
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                {site.logo_url ? (
                  <img
                    src={site.logo_url}
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
                  {site.room_count != null && (
                    <p className="text-xs text-muted-foreground">
                      {site.room_count} locations
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
        {filtered.length === 0 && (
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
      </div>
    </>
  );
}
