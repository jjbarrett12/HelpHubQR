"use client";

import { cn } from "@/lib/utils";
import { QrCode } from "lucide-react";

export function QRPreviewCard({
  slugPreview,
  name,
  className,
}: {
  slugPreview: string;
  name: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 border-dashed border-border/80 bg-background p-4 flex flex-col items-center gap-3",
        className
      )}
    >
      <div
        className="relative h-36 w-36 rounded-lg bg-white text-black flex items-center justify-center shadow-inner border border-zinc-200"
        aria-hidden
      >
        <div className="absolute inset-2 grid grid-cols-6 grid-rows-6 gap-px opacity-90">
          {Array.from({ length: 36 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "rounded-[1px]",
                // pseudo-random checker for placeholder look
                (i * 7 + i % 5) % 3 === 0 ? "bg-zinc-900" : "bg-zinc-100"
              )}
            />
          ))}
        </div>
        <QrCode className="h-14 w-14 text-zinc-800 relative z-10 drop-shadow-sm" strokeWidth={1.25} />
      </div>
      <div className="text-center space-y-1 w-full min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Preview</p>
        <p className="text-xs font-medium truncate px-1">{name}</p>
        <code className="text-[10px] font-mono text-muted-foreground break-all block">/qr/{slugPreview}</code>
      </div>
      <p className="text-[10px] text-center text-muted-foreground leading-snug max-w-[200px]">
        {/* TODO: server PNG/SVG via `qrcode` lib or edge function; printable PDF with org branding */}
        Placeholder pattern — swap for encoded payload + logo when generation is wired.
      </p>
    </div>
  );
}
