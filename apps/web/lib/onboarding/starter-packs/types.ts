import type { IndustryKey } from "../types";

export type StarterChecklistTemplate = {
  /** Stable id for idempotency segments */
  templateId: string;
  roleName: string;
  shift_type: "open" | "mid" | "close" | "custom";
  name: string;
  description?: string;
  items: { task_text: string; sort_order: number; requires_photo: boolean }[];
};

export type StarterQrSuggestion = {
  name: string;
  type: "checklist" | "issue_report" | "help" | "announcement" | "training" | "sop";
  notes?: string;
};

export type StarterPackDefinition = {
  industry: IndustryKey;
  version: number;
  displayName: string;
  defaultRoles: string[];
  checklistTemplates: StarterChecklistTemplate[];
  /** Free-text issue categories suggested in UI / optional taxonomy seeds */
  issueCategoryLabels: string[];
  qrSuggestions: StarterQrSuggestion[];
};
