/**
 * QR Hub — typed mock catalog + scan preview.
 * TODO: Replace with Supabase `qr_destinations`, `locations`, `qr_codes`, scan analytics table or edge logs.
 */

import type { QrDestinationType } from "@/lib/qr/types";

/** Product-facing types in the hub (may map 1:1 or N:1 to `qr_destinations.type`). */
export type QRHubDestinationType =
  | "sop_instruction"
  | "training_video"
  | "checklist_entry"
  | "issue_report"
  | "request_form"
  | "equipment_guide"
  | "emergency_procedure"
  | "cleaning_standard"
  | "station_action_menu";

export const QR_HUB_TYPE_LABEL: Record<QRHubDestinationType, string> = {
  sop_instruction: "SOP / instruction",
  training_video: "Training video",
  checklist_entry: "Checklist entry",
  issue_report: "Issue report",
  request_form: "Request form",
  equipment_guide: "Equipment guide",
  emergency_procedure: "Emergency procedure",
  cleaning_standard: "Cleaning standard",
  station_action_menu: "Station action menu",
};

export interface QRHubDestination {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  zoneOrStation: string;
  type: QRHubDestinationType;
  description: string;
  /** URL, deep link label, or checklist id hint */
  destinationTarget: string;
  isActive: boolean;
  /** Public path segment for /qr/[slug] style routes */
  slugPreview: string;
  scansLast7Days: number;
  scansLast24h: number;
  createdAt: string;
  updatedAt: string;
  /** Map into existing DB enum when persisting */
  dbTypeMapping: QrDestinationType;
}

export interface QRHubScanEvent {
  id: string;
  destinationId: string;
  destinationName: string;
  scannedAt: string;
  locationLabel: string;
  clientHint: string;
}

export const MOCK_QR_DESTINATIONS: QRHubDestination[] = [
  {
    id: "qd-1",
    name: "Lobby housekeeping cart SOP",
    locationId: "loc-main",
    locationName: "Main building",
    zoneOrStation: "Lobby · HK cart A",
    type: "sop_instruction",
    description: "Opening strip + restock sequence for lobby-attached cart.",
    destinationTarget: "https://docs.example.com/sop/lobby-cart",
    isActive: true,
    slugPreview: "m7k2-lobby-cart",
    scansLast7Days: 142,
    scansLast24h: 18,
    createdAt: "2026-01-10T12:00:00Z",
    updatedAt: "2026-03-20T09:00:00Z",
    dbTypeMapping: "sop",
  },
  {
    id: "qd-2",
    name: "Ballroom reset checklist",
    locationId: "loc-events",
    locationName: "Events wing",
    zoneOrStation: "Ballroom",
    type: "checklist_entry",
    description: "Post-event reset — ties to mid shift checklist template.",
    destinationTarget: "checklist:template:events-mid-reset",
    isActive: true,
    slugPreview: "ev9-ballroom-reset",
    scansLast7Days: 56,
    scansLast24h: 4,
    createdAt: "2026-02-01T15:30:00Z",
    updatedAt: "2026-03-18T11:00:00Z",
    dbTypeMapping: "checklist",
  },
  {
    id: "qd-3",
    name: "Commercial washer training",
    locationId: "loc-laundry",
    locationName: "Laundry",
    zoneOrStation: "Wash floor · Unit 2",
    type: "training_video",
    description: "LOTO + detergent handling video (3 min).",
    destinationTarget: "https://training.example.com/wash-unit-2",
    isActive: true,
    slugPreview: "lr-wash2-video",
    scansLast7Days: 89,
    scansLast24h: 6,
    createdAt: "2026-01-22T10:00:00Z",
    updatedAt: "2026-03-01T08:00:00Z",
    dbTypeMapping: "training",
  },
  {
    id: "qd-4",
    name: "Guest issue — pool deck",
    locationId: "loc-pool",
    locationName: "Pool & fitness",
    zoneOrStation: "Pool deck north",
    type: "issue_report",
    description: "Fast path for slip/trip, water quality, furniture damage.",
    destinationTarget: "/t/issue-pool-deck",
    isActive: true,
    slugPreview: "pl-issue-north",
    scansLast7Days: 34,
    scansLast24h: 2,
    createdAt: "2026-02-14T14:00:00Z",
    updatedAt: "2026-03-10T16:20:00Z",
    dbTypeMapping: "issue_report",
  },
  {
    id: "qd-5",
    name: "Engineering request — Tower B",
    locationId: "loc-tower-b",
    locationName: "Tower B",
    zoneOrStation: "Service elevator landing",
    type: "request_form",
    description: "Temperature, noise, door hardware — routes to engineering queue.",
    destinationTarget: "/t/eng-request-tb",
    isActive: true,
    slugPreview: "tb-eng-req",
    scansLast7Days: 21,
    scansLast24h: 1,
    createdAt: "2026-02-20T11:00:00Z",
    updatedAt: "2026-03-12T13:00:00Z",
    dbTypeMapping: "help",
  },
  {
    id: "qd-6",
    name: "Ice machine 12 — quick guide",
    locationId: "loc-main",
    locationName: "Main building",
    zoneOrStation: "L12 pantry",
    type: "equipment_guide",
    description: "Sanitize cycle, filter indicator, lockout tag location.",
    destinationTarget: "https://kb.example.com/ice-12",
    isActive: true,
    slugPreview: "l12-ice-guide",
    scansLast7Days: 67,
    scansLast24h: 5,
    createdAt: "2026-01-05T09:00:00Z",
    updatedAt: "2026-03-15T10:00:00Z",
    dbTypeMapping: "sop",
  },
  {
    id: "qd-7",
    name: "Fire panel — emergency",
    locationId: "loc-main",
    locationName: "Main building",
    zoneOrStation: "Back-of-house core",
    type: "emergency_procedure",
    description: "Acknowledge, silence, evac map, GC number.",
    destinationTarget: "/emergency/fire-panel",
    isActive: true,
    slugPreview: "em-fire-core",
    scansLast7Days: 12,
    scansLast24h: 0,
    createdAt: "2025-11-01T12:00:00Z",
    updatedAt: "2026-01-18T12:00:00Z",
    dbTypeMapping: "help",
  },
  {
    id: "qd-8",
    name: "Public restroom — cleaning standard",
    locationId: "loc-main",
    locationName: "Main building",
    zoneOrStation: "Restroom cluster A",
    type: "cleaning_standard",
    description: "Touch-point list + chemical dilution chart.",
    destinationTarget: "https://standards.example.com/restroom-a",
    isActive: true,
    slugPreview: "rr-std-a",
    scansLast7Days: 201,
    scansLast24h: 28,
    createdAt: "2025-12-01T08:00:00Z",
    updatedAt: "2026-03-22T07:00:00Z",
    dbTypeMapping: "sop",
  },
  {
    id: "qd-9",
    name: "Front desk station menu",
    locationId: "loc-main",
    locationName: "Main building",
    zoneOrStation: "Front desk · Station 2",
    type: "station_action_menu",
    description: "Overrides, manager callback, baggage, taxi script.",
    destinationTarget: "/staff/fd-station-2",
    isActive: true,
    slugPreview: "fd-st2-menu",
    scansLast7Days: 310,
    scansLast24h: 44,
    createdAt: "2025-10-15T13:00:00Z",
    updatedAt: "2026-03-21T22:00:00Z",
    dbTypeMapping: "help",
  },
  {
    id: "qd-10",
    name: "Legacy banquet announcement",
    locationId: "loc-events",
    locationName: "Events wing",
    zoneOrStation: "Pre-function",
    type: "sop_instruction",
    description: "Deprecated signage — replaced by digital board.",
    destinationTarget: "announcement:banquet-spring",
    isActive: false,
    slugPreview: "ev-banq-old",
    scansLast7Days: 3,
    scansLast24h: 0,
    createdAt: "2025-08-01T12:00:00Z",
    updatedAt: "2026-02-28T17:00:00Z",
    dbTypeMapping: "announcement",
  },
];

export const MOCK_LOCATION_OPTIONS = [
  { id: "all", name: "All locations" },
  { id: "loc-main", name: "Main building" },
  { id: "loc-events", name: "Events wing" },
  { id: "loc-laundry", name: "Laundry" },
  { id: "loc-pool", name: "Pool & fitness" },
  { id: "loc-tower-b", name: "Tower B" },
];

export const MOCK_RECENT_SCANS: QRHubScanEvent[] = [
  {
    id: "sc-1",
    destinationId: "qd-9",
    destinationName: "Front desk station menu",
    scannedAt: "2026-03-24T14:02:00Z",
    locationLabel: "Main · Front desk",
    clientHint: "iOS Safari",
  },
  {
    id: "sc-2",
    destinationId: "qd-8",
    destinationName: "Public restroom — cleaning standard",
    scannedAt: "2026-03-24T13:58:00Z",
    locationLabel: "Main · Restroom A",
    clientHint: "Android Chrome",
  },
  {
    id: "sc-3",
    destinationId: "qd-1",
    destinationName: "Lobby housekeeping cart SOP",
    scannedAt: "2026-03-24T13:45:00Z",
    locationLabel: "Main · Lobby",
    clientHint: "iOS Safari",
  },
  {
    id: "sc-4",
    destinationId: "qd-3",
    destinationName: "Commercial washer training",
    scannedAt: "2026-03-24T13:12:00Z",
    locationLabel: "Laundry",
    clientHint: "Wall tablet",
  },
  {
    id: "sc-5",
    destinationId: "qd-4",
    destinationName: "Guest issue — pool deck",
    scannedAt: "2026-03-24T12:30:00Z",
    locationLabel: "Pool deck north",
    clientHint: "Guest mobile",
  },
  {
    id: "sc-6",
    destinationId: "qd-2",
    destinationName: "Ballroom reset checklist",
    scannedAt: "2026-03-24T11:55:00Z",
    locationLabel: "Events · Ballroom",
    clientHint: "Staff PWA",
  },
];

/** Map hub taxonomy to existing `qr_destinations.type` enum until subtype column exists. */
export function hubTypeToDbType(type: QRHubDestinationType): QrDestinationType {
  const m: Record<QRHubDestinationType, QrDestinationType> = {
    sop_instruction: "sop",
    training_video: "training",
    checklist_entry: "checklist",
    issue_report: "issue_report",
    request_form: "help",
    equipment_guide: "sop",
    emergency_procedure: "help",
    cleaning_standard: "sop",
    station_action_menu: "help",
  };
  return m[type];
}

export function summarizeDestinations(rows: QRHubDestination[]) {
  const active = rows.filter((r) => r.isActive).length;
  const locs = new Set(rows.map((r) => r.locationId)).size;
  const scans24 = rows.reduce((a, r) => a + r.scansLast24h, 0);
  const scans7 = rows.reduce((a, r) => a + r.scansLast7Days, 0);
  return {
    total: rows.length,
    active,
    inactive: rows.length - active,
    locationsCovered: locs,
    scans24h: scans24,
    scans7d: scans7,
  };
}
