export type OcrResult = {
  /** Raw transcription; use [illegible] or similar markers where text is uncertain. */
  text: string;
  /** Provider-reported confidence 0–1 when available. */
  confidence: number | null;
};

export class OcrUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrUnavailableError";
  }
}

export type OcrProvider = (input: { imageBase64: string; mimeType: string }) => Promise<OcrResult>;
