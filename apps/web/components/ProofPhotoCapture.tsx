"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type ProofPhotoCaptureProps = {
  onCapture?: (file: File) => void;
  onUploadComplete?: (path: string) => void;
  taskId: string;
  /** Staff JWT for /api/upload/sign */
  authToken?: string | null;
  disabled?: boolean;
  className?: string;
};

/**
 * MVP: optional file input for proof photo. Full camera capture + signed upload in Milestone 3.
 */
export function ProofPhotoCapture({
  onCapture,
  onUploadComplete,
  taskId,
  authToken,
  disabled,
  className,
}: ProofPhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    onCapture?.(file);
    setUploading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const signRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers,
        body: JSON.stringify({ taskId, contentType: file.type }),
      });
      const signData = await signRes.json().catch(() => ({}));
      if (!signRes.ok || !signData.signedUrl) {
        setUploading(false);
        return;
      }
      const putRes = await fetch(signData.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (putRes.ok && signData.path) {
        onUploadComplete?.(signData.path);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
        disabled={disabled || uploading}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading…" : "Add photo"}
      </Button>
    </div>
  );
}
