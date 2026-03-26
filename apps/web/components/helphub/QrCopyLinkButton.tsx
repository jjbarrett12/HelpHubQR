"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function QrCopyLinkButton({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* ignore */
        }
      }}
    >
      {done ? "Copied" : "Copy link"}
    </Button>
  );
}
