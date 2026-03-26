import { z } from "zod";

export const aiChecklistImportSchema = z.object({
  checklist_name: z.string().min(1).max(200),
  shift_type: z.enum(["open", "mid", "close", "custom"]).nullable().optional(),
  tasks: z.array(z.object({ task_text: z.string().min(1).max(2000) })).min(1).max(200),
  notes: z.string().max(2000).optional(),
  /** Model self-reported confidence for the structured parse (0–1). */
  parse_confidence: z.number().min(0).max(1).optional(),
});

export type AiChecklistImport = z.infer<typeof aiChecklistImportSchema>;

export type AiChecklistImportRow = AiChecklistImport & {
  raw_model_notes?: string;
};
