import { PublicTicketForm } from "@/components/public/PublicTicketForm";
import { InvalidLinkBlock } from "@/components/public/InvalidLinkBlock";

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
  if (!token?.trim()) {
    return (
      <InvalidLinkBlock
        message="Room link is missing or invalid."
        hint="Scan the QR code in your room again, or ask the front desk for a new one."
      />
    );
  }
  const resolved = await resolveToken(token);
  if (!resolved) {
    return (
      <InvalidLinkBlock
        message="This room link is invalid or expired."
        hint="Scan the QR code in your room again, or ask the front desk for assistance."
      />
    );
  }

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a]">
            Request Housekeeping
          </h1>
          {resolved.site_name && (
            <p className="guest-text-muted mt-1 text-sm">{resolved.site_name}</p>
          )}
          <p className="mt-2 text-base font-medium text-[#dc2626]">{resolved.room_label}</p>
        </div>
        <div className="guest-card rounded-xl border p-6 shadow-sm">
          <PublicTicketForm token={token} roomLabel={resolved.room_label} />
        </div>
      </div>
    </main>
  );
}
