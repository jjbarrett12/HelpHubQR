"use client";

import { useState } from "react";
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
import { requestTypes } from "@/lib/validators";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export function PublicTicketForm({
  token,
  roomLabel,
}: {
  token: string;
  roomLabel: string;
}) {
  const router = useRouter();
  const [requestType, setRequestType] = useState<string>("");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");
  const [guestEmail, setGuestEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = note.trim();
    if (trimmed.length < 5) {
      setError("Please enter at least 5 characters in the note.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          request_type: requestType || null,
          note: trimmed,
          priority,
          guest_email: guestEmail.trim() || null,
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
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="request_type">Request type</Label>
        <Select value={requestType} onValueChange={setRequestType}>
          <SelectTrigger id="request_type">
            <SelectValue placeholder="Select type (optional)" />
          </SelectTrigger>
          <SelectContent>
            {requestTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
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
