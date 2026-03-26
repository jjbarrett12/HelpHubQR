import OpenAI from "openai";
import { aiChecklistImportSchema, type AiChecklistImport } from "./schemas";

const SYSTEM = `You convert noisy OCR text from employee duty / closing / opening checklists into structured JSON.
Rules:
- Infer a short checklist_name when obvious; otherwise use a neutral title like "Imported checklist".
- shift_type: only set if clearly implied (open/mid/close). Otherwise null. Use "custom" only if labeled custom.
- tasks: one entry per distinct duty line. Merge exact duplicate bullets.
- Strip dates and day-of-week headers unless they are clearly part of the task wording.
- Keep wording short and operational. Do not invent duties not supported by the source text.
- If OCR used [illegible], keep those segments in task_text so a manager can fix them.
- Respond with JSON only matching the schema described in the user message.`;

export async function normalizeChecklistFromOcrText(ocrText: string): Promise<AiChecklistImport> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const model = process.env.OPENAI_IMPORT_TEXT_MODEL ?? "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const user = `OCR text:\n---\n${ocrText.slice(0, 120000)}\n---\n
Return a JSON object with keys:
- checklist_name (string)
- shift_type (null or one of: open, mid, close, custom)
- tasks (array of objects with task_text string)
- notes (optional string for parser comments)
- parse_confidence (optional number 0-1: your confidence in the structured extraction)`;

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Normalization model returned empty content");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Normalization model returned non-JSON");
  }

  const validated = aiChecklistImportSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Invalid AI structure: ${validated.error.message}`);
  }

  return validated.data;
}
