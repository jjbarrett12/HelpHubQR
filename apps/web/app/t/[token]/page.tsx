import { PublicTicketForm } from "@/components/public/PublicTicketForm";
import { InvalidLinkBlock } from "@/components/public/InvalidLinkBlock";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";

type ResolveRpc = { ok?: boolean; code?: string; site_name?: string; room_label?: string };

async function resolveToken(
  token: string
): Promise<{ site_name: string; room_label: string } | { code: string } | null> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("hh_room_token_resolve_guest", {
      p_raw_token: token,
    });
    if (error || !data) return null;
    const row = data as ResolveRpc;
    if (!row.ok) {
      return row.code ? { code: row.code } : null;
    }
    if (!row.site_name || row.room_label == null) return null;
    return { site_name: row.site_name, room_label: row.room_label };
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
  if (!resolved || "code" in resolved) {
    if (resolved && "code" in resolved && resolved.code === "archived") {
      return (
        <InvalidLinkBlock
          message="This room link is no longer active."
          hint="This location may have been retired. Ask the front desk for an updated QR code or use the current guest link for your room."
        />
      );
    }
    return (
      <InvalidLinkBlock
        message="This room link is invalid or expired."
        hint="Scan the QR code in your room again, or ask the front desk for assistance."
      />
    );
  }

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-4 sm:p-8">
      <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-6 sm:max-w-xl sm:gap-8 md:max-w-4xl md:grid-cols-2 md:items-start md:gap-10 lg:max-w-5xl">
        <div className="space-y-2 text-center md:pt-2 md:text-left">
          <h1 className="text-2xl font-semibold tracking-tight text-[#0f172a] sm:text-3xl">
            Request Housekeeping
          </h1>
          {resolved.site_name && (
            <p className="guest-text-muted text-sm sm:text-base">{resolved.site_name}</p>
          )}
          <p className="text-lg font-medium text-[#dc2626] sm:text-xl">{resolved.room_label}</p>
        </div>
        <div className="guest-card rounded-xl border p-6 shadow-sm sm:p-8">
          <PublicTicketForm token={token} roomLabel={resolved.room_label} />
        </div>
      </div>
    </main>
  );
}
