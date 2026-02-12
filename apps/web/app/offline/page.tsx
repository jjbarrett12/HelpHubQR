import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="guest-theme flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold text-[#0f172a]">You&apos;re offline</h1>
      <p className="max-w-sm text-[#64748b]">
        When you&apos;re back online, your queued actions will sync automatically.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
