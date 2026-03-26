import OpenAI from "openai";
import type { OcrResult } from "./types";

/**
 * Vision-backed transcription. Treat as OCR layer: output plain text only, no JSON.
 */
export async function openaiVisionOcr(input: { imageBase64: string; mimeType: string }): Promise<OcrResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  const model = process.env.OPENAI_IMPORT_VISION_MODEL ?? "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const dataUrl = `data:${input.mimeType};base64,${input.imageBase64}`;

  const completion = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: `You transcribe text visible in workplace photos (printed lists, handwriting, laminated sheets).
Rules:
- Output plain text only. Preserve line breaks and bullet order.
- Do not summarize or interpret.
- If a word is unclear, write [illegible] instead of guessing.
- Do not add tasks that are not visibly present.`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Transcribe all readable text from this image." },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("Vision model returned empty transcription");
  }

  return {
    text,
    confidence: null,
  };
}
