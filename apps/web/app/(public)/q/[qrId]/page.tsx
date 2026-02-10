"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { shouldShowStaff, guestUrl, staffUrl } from "@/lib/qr/routing";

type ResolveData = {
  property: { id: string; name: string; branding: Record<string, unknown> };
  location: { id: string; type: string; identifier: string };
  mode_default: "auto" | "guest" | "staff";
};

const STAFF_TOKEN_KEY = "helphub_staff_token";
const STAFF_ROLE_KEY = "helphub_staff_role";

function getStaffToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STAFF_TOKEN_KEY);
}

export default function QEntryPage() {
  const params = useParams();
  const router = useRouter();
  const qrId = params.qrId as string;
  const [resolve, setResolve] = useState<ResolveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffKey, setStaffKey] = useState("");
  const [staffAuthLoading, setStaffAuthLoading] = useState(false);
  const [staffAuthError, setStaffAuthError] = useState<string | null>(null);

  const fetchResolve = useCallback(async () => {
    if (!qrId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/q/resolve?qrId=${encodeURIComponent(qrId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Invalid QR");
        setResolve(null);
        return;
      }
      setResolve(data);
    } catch {
      setError("Network error");
      setResolve(null);
    } finally {
      setLoading(false);
    }
  }, [qrId]);

  useEffect(() => {
    fetchResolve();
  }, [fetchResolve]);

  useEffect(() => {
    if (!resolve || !qrId) return;
    const token = getStaffToken();
    const hasValidStaffSession = !!token;
    if (shouldShowStaff(resolve.mode_default, hasValidStaffSession)) {
      router.replace(staffUrl(qrId));
      return;
    }
  }, [resolve, qrId, router]);

  const handleGuestClick = () => {
    if (resolve) router.push(guestUrl(qrId));
  };

  const handleStaffKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffAuthError(null);
    setStaffAuthLoading(true);
    try {
      const res = await fetch("/api/staff/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrId, key: staffKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStaffAuthError(data.error ?? "Invalid key");
        return;
      }
      if (typeof window !== "undefined" && data.staffSessionToken) {
        sessionStorage.setItem(STAFF_TOKEN_KEY, data.staffSessionToken);
        if (data.role) sessionStorage.setItem(STAFF_ROLE_KEY, data.role);
      }
      setStaffModalOpen(false);
      router.push(staffUrl(qrId));
    } catch {
      setStaffAuthError("Network error");
    } finally {
      setStaffAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (error || !resolve) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <p className="text-destructive">{error ?? "Invalid QR"}</p>
        <Link href="/">
          <Button variant="outline">Go home</Button>
        </Link>
      </div>
    );
  }

  const propertyName = resolve.property.name;
  const locationLabel = resolve.location.type === "room" ? `Room ${resolve.location.identifier}` : resolve.location.identifier;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-foreground">{propertyName}</h1>
        <p className="mt-1 text-muted-foreground">{locationLabel}</p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button size="lg" className="w-full" onClick={handleGuestClick}>
          I&apos;m a guest – request service
        </Button>
        <button
          type="button"
          className="text-sm text-muted-foreground underline hover:text-foreground"
          onClick={() => setStaffModalOpen(true)}
        >
          I&apos;m staff
        </button>
      </div>

      {staffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-card p-4 shadow-lg">
            <h2 className="font-semibold text-foreground">Staff sign-in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Enter your shift key or PIN.</p>
            <form onSubmit={handleStaffKeySubmit} className="mt-4 space-y-3">
              <input
                type="password"
                placeholder="Key or PIN"
                value={staffKey}
                onChange={(e) => setStaffKey(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                autoFocus
              />
              {staffAuthError && (
                <p className="text-sm text-destructive">{staffAuthError}</p>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStaffModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={staffAuthLoading}>
                  {staffAuthLoading ? "Checking…" : "Continue"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
