import { notFound } from "next/navigation";
import { PublicTicketForm } from "@/components/public/PublicTicketForm";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

async function resolveToken(token: string): Promise<{ site_name: string; room_label: string } | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/resolve-room?token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return { site_name: data.site_name, room_label: data.room_label };
  } catch {
    return null;
  }
}

export default async function PublicTicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await resolveToken(token);
  if (!resolved) notFound();

  return (
    <main className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Request Housekeeping
          </h1>
          {resolved.site_name && (
            <p className="text-sm text-muted-foreground mt-1">
              {resolved.site_name}
            </p>
          )}
          <p className="text-sm font-medium text-primary mt-2">
            Room {resolved.room_label}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm p-6">
          <PublicTicketForm token={token} roomLabel={resolved.room_label} />
        </div>
      </div>
    </main>
  );
}
