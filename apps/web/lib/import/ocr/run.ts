import type { OcrResult } from "./types";
import { OcrUnavailableError } from "./types";
import { openaiVisionOcr } from "./openai-vision";

export async function runOcrOnImage(buffer: Buffer, mimeType: string): Promise<OcrResult> {
  const provider = (process.env.IMPORT_OCR_PROVIDER ?? "").trim().toLowerCase();
  const base64 = buffer.toString("base64");

  if (provider === "openai_vision") {
    return openaiVisionOcr({ imageBase64: base64, mimeType });
  }

  if (provider === "" || provider === "none") {
    throw new OcrUnavailableError(
      'OCR is not configured. Set IMPORT_OCR_PROVIDER=openai_vision and OPENAI_API_KEY, or plug another provider in lib/import/ocr/run.ts.'
    );
  }

  throw new OcrUnavailableError(`Unknown IMPORT_OCR_PROVIDER "${provider}". Supported: openai_vision, none.`);
}
