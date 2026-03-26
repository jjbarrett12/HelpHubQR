export const QR_DESTINATION_TYPES = [
  "checklist",
  "training",
  "sop",
  "issue_report",
  "announcement",
  "help",
] as const;

export type QrDestinationType = (typeof QR_DESTINATION_TYPES)[number];

/** Stored in qr_destinations.content (jsonb); keep flat and small. */
export type QrDestinationContent = {
  title?: string;
  body?: string;
  videoUrl?: string;
  /** Announcement bullets */
  items?: string[];
  phone?: string;
  email?: string;
  /** Issue form intro */
  prompt?: string;
};

export function parseQrDestinationType(raw: string): QrDestinationType | null {
  return QR_DESTINATION_TYPES.includes(raw as QrDestinationType) ? (raw as QrDestinationType) : null;
}
