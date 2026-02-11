"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function ExportTicketsButton({ siteId }: { siteId: string }) {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDate(d);
  });
  const [to, setTo] = useState(() => formatDate(new Date()));

  const url = `/api/tickets/export?siteId=${encodeURIComponent(siteId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        aria-label="From date"
      />
      <span className="text-muted-foreground">–</span>
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        aria-label="To date"
      />
      <Button variant="outline" size="sm" asChild>
        <a href={url} download className="gap-1.5">
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </Button>
    </div>
  );
}
