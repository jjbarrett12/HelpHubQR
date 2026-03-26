"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "#fef2f2", color: "#991b1b" }}>
      <div style={{ maxWidth: "400px", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "8px" }}>Something went wrong</h1>
        <p style={{ fontSize: "0.875rem", marginBottom: "16px" }}>{error.message || "An unexpected error occurred."}</p>
        <button type="button" onClick={reset} style={{ padding: "8px 16px", background: "#b91c1c", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>Try again</button>
      </div>
    </div>
  );
}
