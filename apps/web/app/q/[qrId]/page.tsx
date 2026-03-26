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
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#dc2626] border-t-transparent" aria-hidden />
        <p className="guest-text-muted text-center text-base">Loading…</p>
      </div>
    );
  }

  if (error || !resolve) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6">
        <p className="text-center text-base font-medium text-red-600" role="alert">
          {error ?? "Invalid QR"}
        </p>
        <Link href="/">
          <Button variant="outline" size="lg" className="min-h-12 px-6">
            Go home
          </Button>
        </Link>
      </div>
    );
  }

  const propertyName = resolve.property.name;
  const locationLabel = resolve.location.identifier;

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-stretch justify-center gap-8 p-6 sm:max-w-2xl sm:gap-10 md:max-w-4xl md:flex-row md:items-center md:justify-center md:gap-14 lg:max-w-5xl lg:gap-20">
      <div className="w-full text-center md:max-w-sm md:flex-1 md:text-left lg:max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a] sm:text-3xl md:text-3xl">
          {propertyName}
        </h1>
        <p className="mt-2 guest-text-muted text-base sm:text-lg">{locationLabel}</p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-4 md:max-w-xs md:flex-1 lg:max-w-sm">
        <Button
          size="lg"
          className="h-14 w-full min-h-14 rounded-xl text-base font-semibold"
          onClick={handleGuestClick}
        >
          I&apos;m a guest – request service
        </Button>
        <button
          type="button"
          className="guest-text-muted min-h-[44px] text-base underline underline-offset-2 active:opacity-80"
          onClick={() => setStaffModalOpen(true)}
        >
          I&apos;m staff
        </button>
      </div>

      {staffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6">
          <div className="guest-card w-full max-w-sm rounded-xl border p-5 shadow-lg sm:max-w-md md:max-w-lg">
            <h2 className="text-lg font-semibold text-[#0f172a]">Staff sign-in</h2>
            <p className="mt-1 text-sm guest-text-muted">Enter your shift key or PIN.</p>
            <form onSubmit={handleStaffKeySubmit} className="mt-4 space-y-3">
              <input
                type="password"
                placeholder="Key or PIN"
                value={staffKey}
                onChange={(e) => setStaffKey(e.target.value)}
                className="guest-input w-full rounded-lg border px-4 py-3 text-base"
                autoFocus
              />
              {staffAuthError && (
                <p className="text-sm font-medium text-red-600" role="alert">{staffAuthError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12 flex-1"
                  onClick={() => setStaffModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="min-h-12 flex-1" disabled={staffAuthLoading}>
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
