export function getPublicAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return raw.replace(/\/$/, "");
}

export function publicChecklistUrl(token: string): string {
  const base = getPublicAppOrigin();
  const path = `/public/checklist/${encodeURIComponent(token)}`;
  return base ? `${base}${path}` : path;
}
