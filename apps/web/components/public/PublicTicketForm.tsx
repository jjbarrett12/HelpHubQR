"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TICKET_REQUEST_TYPE_OPTIONS } from "@/lib/tickets/request-types-catalog";

const NO_REQUEST_TYPE = "__none__";

export function PublicTicketForm({
  token,
  roomLabel,
}: {
  token: string;
  roomLabel: string;
}) {
  const router = useRouter();
  const [requestTypeCode, setRequestTypeCode] = useState<string>("");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [guestEmail, setGuestEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLock = useRef(false);
  const clientRequestId = useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    []
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (submitLock.current || loading) return;
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      setError("Please enter at least 5 characters in the note.");
      return;
    }
    submitLock.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/public/guest-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          request_type_code: requestTypeCode ? requestTypeCode : null,
          note: trimmed,
          priority,
          guest_email: guestEmail.trim() || null,
          client_request_id: clientRequestId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }
      if (data.status_token) {
        router.push(`/t/status/${data.status_token}`);
      } else {
        router.push("/t/" + token + "/success");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      submitLock.current = false;
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="request_type">Request type</Label>
        <Select
          value={requestTypeCode || NO_REQUEST_TYPE}
          onValueChange={(v) => setRequestTypeCode(v === NO_REQUEST_TYPE ? "" : v)}
        >
          <SelectTrigger id="request_type">
            <SelectValue placeholder="Select type (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_REQUEST_TYPE}>No preference</SelectItem>
            {TICKET_REQUEST_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.code} value={opt.code}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Details (required)</Label>
        <Textarea
          id="note"
          placeholder="e.g. Need fresh towels and trash removed"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          minLength={5}
          required
          rows={4}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground">At least 5 characters</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="guest_email">Email (optional – we&apos;ll notify you when done)</Label>
        <Input
          id="guest_email"
          type="email"
          placeholder="you@example.com"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Priority</Label>
        <Select
          value={priority}
          onValueChange={(v) => setPriority(v as "low" | "normal" | "high")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Sending…" : "Submit request"}
      </Button>
    </form>
  );
}
