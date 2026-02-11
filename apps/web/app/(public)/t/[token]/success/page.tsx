import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export default async function SuccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-4">
      <div className="guest-card w-full max-w-md rounded-xl border p-6 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#dc2626]/10">
            <CheckCircle2 className="h-8 w-8 text-[#dc2626]" />
          </div>
          <h1 className="text-xl font-semibold text-[#0f172a]">Thank you</h1>
          <p className="guest-text-muted mt-1">Your request has been sent. We&apos;re on it.</p>
        </div>
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" size="lg" className="min-h-12">
            <Link href={`/t/${token}`}>Submit another request</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
