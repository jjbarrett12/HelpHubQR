"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export function QrIssueReportForm({ slug }: { slug: string }) {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      setErr("Please enter at least a few words.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/qr/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, message: trimmed, contact: contact.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      setStatus("done");
      setMessage("");
      setContact("");
    } catch {
      setErr("Network error.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-foreground">
        Thanks — your report was submitted.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="qr_issue_msg">What happened?</Label>
        <Textarea
          id="qr_issue_msg"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          required
          minLength={3}
          maxLength={4000}
          className="bg-background/80 resize-y"
          placeholder="Equipment, location, and what you noticed…"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="qr_issue_contact">Your name or phone (optional)</Label>
        <Input
          id="qr_issue_contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={240}
          className="bg-background/80"
        />
      </div>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      <Button type="submit" disabled={status === "loading"} className="w-full sm:w-auto">
        {status === "loading" ? "Sending…" : "Submit report"}
      </Button>
    </form>
  );
}
