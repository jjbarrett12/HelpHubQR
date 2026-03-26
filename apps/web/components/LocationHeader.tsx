"use client";

import { cn } from "@/lib/utils";

export type LocationHeaderProps = {
  locationIdentifier: string;
  locationType?: string;
  propertyName?: string;
  logoUrl?: string | null;
  className?: string;
};

export function LocationHeader({
  locationIdentifier,
  locationType,
  propertyName,
  logoUrl,
  className,
}: LocationHeaderProps) {
  return (
    <header
      className={cn(
        "flex min-w-0 items-center justify-between gap-2 border-b border-border/60 bg-card px-4 py-3 sm:px-5",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded object-contain"
          />
        )}
        <div className="min-w-0">
          <h1 className="truncate font-semibold text-foreground">
            {locationIdentifier}
          </h1>
          {propertyName && (
            <p className="truncate text-xs text-muted-foreground">{propertyName}</p>
          )}
        </div>
      </div>
    </header>
  );
}
