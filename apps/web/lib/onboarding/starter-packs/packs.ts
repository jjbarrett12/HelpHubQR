import type { StarterPackDefinition } from "./types";

const baseRoles = ["Shift lead", "Team member"];

export const STARTER_PACKS: Record<string, StarterPackDefinition> = {
  janitorial: {
    industry: "janitorial",
    version: 1,
    displayName: "Janitorial",
    defaultRoles: [...baseRoles, "Site supervisor"],
    issueCategoryLabels: ["Supply shortage", "Equipment", "Safety", "Client request", "Access"],
    qrSuggestions: [
      { name: "Report an issue", type: "issue_report" },
      { name: "Shift checklist", type: "checklist" },
    ],
    checklistTemplates: [
      {
        templateId: "open_clean",
        roleName: "Team member",
        shift_type: "open",
        name: "Opening — site reset",
        description: "Standard opening tasks",
        items: [
          { task_text: "Restock supplies on cart", sort_order: 0, requires_photo: false },
          { task_text: "Vacuum high-traffic areas", sort_order: 1, requires_photo: false },
          { task_text: "Sanitize restrooms", sort_order: 2, requires_photo: true },
        ],
      },
      {
        templateId: "close_clean",
        roleName: "Team member",
        shift_type: "close",
        name: "Closing — lockup",
        items: [
          { task_text: "Empty trash in public areas", sort_order: 0, requires_photo: false },
          { task_text: "Secure storage and alarms", sort_order: 1, requires_photo: true },
        ],
      },
    ],
  },
  facilities: {
    industry: "facilities",
    version: 1,
    displayName: "Facilities",
    defaultRoles: [...baseRoles, "Maintenance tech"],
    issueCategoryLabels: ["HVAC", "Plumbing", "Electrical", "Grounds", "Security"],
    qrSuggestions: [
      { name: "Submit work request", type: "issue_report" },
      { name: "Equipment help", type: "help" },
    ],
    checklistTemplates: [
      {
        templateId: "rounds",
        roleName: "Maintenance tech",
        shift_type: "open",
        name: "Morning building rounds",
        items: [
          { task_text: "Check mechanical rooms", sort_order: 0, requires_photo: false },
          { task_text: "Log meter readings", sort_order: 1, requires_photo: true },
        ],
      },
    ],
  },
  restaurant: {
    industry: "restaurant",
    version: 1,
    displayName: "Restaurant",
    defaultRoles: [...baseRoles, "FOH lead", "BOH lead"],
    issueCategoryLabels: ["Food safety", "Equipment", "Guest complaint", "Staffing"],
    qrSuggestions: [
      { name: "Guest feedback", type: "issue_report" },
      { name: "Opening checklist", type: "checklist" },
    ],
    checklistTemplates: [
      {
        templateId: "foh_open",
        roleName: "FOH lead",
        shift_type: "open",
        name: "FOH opening",
        items: [
          { task_text: "Dining room setup", sort_order: 0, requires_photo: false },
          { task_text: "Sanitizer stations filled", sort_order: 1, requires_photo: true },
        ],
      },
      {
        templateId: "boh_open",
        roleName: "BOH lead",
        shift_type: "open",
        name: "BOH opening",
        items: [
          { task_text: "Line prep complete", sort_order: 0, requires_photo: false },
          { task_text: "Walk-in temp log", sort_order: 1, requires_photo: true },
        ],
      },
    ],
  },
  hospitality: {
    industry: "hospitality",
    version: 1,
    displayName: "Hospitality",
    defaultRoles: [...baseRoles, "Housekeeping", "Front desk"],
    issueCategoryLabels: ["Guest room", "Public area", "Maintenance", "Safety"],
    qrSuggestions: [
      { name: "Guest request", type: "issue_report" },
      { name: "Housekeeping checklist", type: "checklist" },
    ],
    checklistTemplates: [
      {
        templateId: "hk_turn",
        roleName: "Housekeeping",
        shift_type: "custom",
        name: "Room turnover",
        items: [
          { task_text: "Linen change", sort_order: 0, requires_photo: false },
          { task_text: "Bathroom refresh", sort_order: 1, requires_photo: true },
        ],
      },
    ],
  },
  events: {
    industry: "events",
    version: 1,
    displayName: "Events",
    defaultRoles: [...baseRoles, "Event lead", "Runner"],
    issueCategoryLabels: ["Venue", "AV", "Safety", "Vendor"],
    qrSuggestions: [
      { name: "Report incident", type: "issue_report" },
      { name: "Event day checklist", type: "checklist" },
    ],
    checklistTemplates: [
      {
        templateId: "event_load",
        roleName: "Event lead",
        shift_type: "open",
        name: "Load-in checklist",
        items: [
          { task_text: "Signage placed", sort_order: 0, requires_photo: true },
          { task_text: "Safety walk completed", sort_order: 1, requires_photo: false },
        ],
      },
    ],
  },
  general: {
    industry: "general",
    version: 1,
    displayName: "General",
    defaultRoles: baseRoles,
    issueCategoryLabels: ["Operations", "Safety", "Equipment", "Other"],
    qrSuggestions: [{ name: "Report an issue", type: "issue_report" }],
    checklistTemplates: [
      {
        templateId: "daily",
        roleName: "Team member",
        shift_type: "open",
        name: "Daily shift start",
        items: [
          { task_text: "Review handoff notes", sort_order: 0, requires_photo: false },
          { task_text: "Complete opening tasks", sort_order: 1, requires_photo: false },
        ],
      },
    ],
  },
};

export function getStarterPack(industry: string | null | undefined): StarterPackDefinition {
  const key = industry && industry in STARTER_PACKS ? industry : "general";
  return STARTER_PACKS[key] ?? STARTER_PACKS.general;
}
