"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type Site = { id: string; name: string };

export function SiteNavWithSearch({ sites }: { sites: Site[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter((s) => s.name.toLowerCase().includes(q));
  }, [sites, query]);

  return (
    <>
      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Filter sites…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 pl-8 text-sm"
            aria-label="Filter sites"
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">No sites match</p>
      ) : (
        filtered.map((site) => (
          <Link key={site.id} href={`/app/sites/${site.id}`}>
            <Button variant="ghost" className="w-full justify-start font-normal">
              {site.name}
            </Button>
          </Link>
        ))
      )}
    </>
  );
}
