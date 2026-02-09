import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Show room label with a single "Room" prefix (avoids "Room Room4" when label is "Room4"). */
export function formatRoomDisplay(roomLabel: string | null | undefined): string {
  const s = (roomLabel ?? "").trim();
  if (!s) return "Room";
  const m = s.match(/^Room\s*(.*)$/i);
  return m ? "Room " + (m[1] ?? "").trim() : "Room " + s;
}

/** Compare two strings in natural order (e.g. Room 2 before Room 10). */
export function naturalCompare(a: string, b: string): number {
  const segsA = (a ?? "").split(/(\d+)/);
  const segsB = (b ?? "").split(/(\d+)/);
  for (let i = 0; i < Math.min(segsA.length, segsB.length); i++) {
    const x = segsA[i];
    const y = segsB[i];
    const numA = /^\d+$/.test(x) ? parseInt(x, 10) : NaN;
    const numB = /^\d+$/.test(y) ? parseInt(y, 10) : NaN;
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      if (numA !== numB) return numA - numB;
    } else {
      const cmp = (x ?? "").toLowerCase().localeCompare((y ?? "").toLowerCase(), undefined, { sensitivity: "base" });
      if (cmp !== 0) return cmp;
    }
  }
  return (segsA.length ?? 0) - (segsB.length ?? 0);
}
