"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function EnablePushNotifications({ siteId }: { siteId: string }) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        "Notification" in window &&
        "PushManager" in window &&
        "serviceWorker" in navigator
    );
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  async function handleEnable() {
    setMessage(null);
    setLoading(true);
    try {
      if (!VAPID_PUBLIC_KEY) {
        setMessage(
          "Push not configured: add NEXT_PUBLIC_VAPID_PUBLIC_KEY to apps/web/.env.local (same value as VAPID_PUBLIC_KEY in Supabase Edge secrets). See apps/web/ENV_SETUP.md."
        );
        return;
      }
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        setMessage("Supabase URL or anon key missing.");
        return;
      }

      // Register our service worker so we control push
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      if (Notification.permission === "default") {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== "granted") {
          setMessage("Notifications were denied. Enable them in your browser and try again.");
          return;
        }
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: arrayBufferToBase64Url(sub.getKey("p256dh")!),
          auth: arrayBufferToBase64Url(sub.getKey("auth")!),
        },
      };

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setMessage("Please sign in to enable notifications.");
        return;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/register-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ site_id: siteId, subscription }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || `Failed to register (${res.status}).`);
        return;
      }
      setMessage("Notifications enabled for this site.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;
  if (permission === "granted") {
    return (
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Bell className="h-4 w-4" />
        Notifications on
      </span>
    );
  }

  const vapidConfigured = Boolean(VAPID_PUBLIC_KEY);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleEnable}
          disabled={loading || !vapidConfigured}
        >
          <BellOff className="h-4 w-4 mr-1" />
          {loading ? "Enabling…" : "Enable push notifications"}
        </Button>
        {message && (
          <span
            className={`text-xs max-w-xs ${message.startsWith("Notifications enabled") ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
          >
            {message}
          </span>
        )}
      </div>
      {!vapidConfigured && (
        <p className="text-xs text-muted-foreground max-w-md">
          Push not configured: set <code className="rounded bg-muted px-1 py-0.5">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> in{" "}
          <code className="rounded bg-muted px-1 py-0.5">apps/web/.env.local</code> (same as{" "}
          <code className="rounded bg-muted px-1 py-0.5">VAPID_PUBLIC_KEY</code> in Supabase Edge secrets). See{" "}
          <code className="rounded bg-muted px-1 py-0.5">apps/web/ENV_SETUP.md</code>.
        </p>
      )}
    </div>
  );
}
