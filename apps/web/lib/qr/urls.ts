import { getPublicAppOrigin } from "@/lib/helphub/app-url";

export function publicQrScanUrl(slug: string): string {
  const base = getPublicAppOrigin();
  const path = `/qr/${encodeURIComponent(slug)}`;
  return base ? `${base}${path}` : path;
}
