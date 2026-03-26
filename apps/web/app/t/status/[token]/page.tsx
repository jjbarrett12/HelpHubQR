import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { Button } from "@/components/ui/button";
import { InvalidLinkBlock } from "@/components/public/InvalidLinkBlock";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; icon: typeof Clock; description: string }> = {
  new: { label: "Received", icon: CheckCircle2, description: "We've received your request and will get to it soon." },
  in_progress: { label: "In progress", icon: Loader2, description: "Someone is working on your request." },
  resolved: { label: "Done", icon: CheckCircle2, description: "Your request has been completed." },
  cancelled: { label: "Cancelled", icon: XCircle, description: "This request was cancelled." },
};

export default async function GuestStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: row } = await supabase
    .from("guest_status_tokens")
    .select("ticket_id, expires_at")
    .eq("token", token)
    .single();

  if (!row || new Date(row.expires_at) <= new Date()) {
    return (
      <InvalidLinkBlock
        message="This status link has expired."
        hint="Status links expire after 48 hours. Your request is still being handled."
      />
    );
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, status, room_label_snapshot, request_type_label_snapshot, created_at, resolved_at")
    .eq("id", row.ticket_id)
    .single();

  if (!ticket) {
    return (
      <InvalidLinkBlock
        message="This status link is invalid."
        hint="You can go home or log in to check on your request."
      />
    );
  }

  const statusInfo = STATUS_LABELS[ticket.status] ?? {
    label: ticket.status,
    icon: Clock,
    description: "Your request status.",
  };
  const Icon = statusInfo.icon;
  const isNew = ticket.status === "new";
  const justSubmitted = isNew && Date.now() - new Date(ticket.created_at).getTime() < 2 * 60 * 1000;

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-4">
      <div className="guest-card w-full max-w-md space-y-4 rounded-xl border p-6 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#dc2626]/10">
            <Icon className="h-8 w-8 text-[#dc2626]" />
          </div>
          {justSubmitted ? (
            <>
              <h1 className="text-xl font-semibold text-[#0f172a]">Thank you</h1>
              <p className="guest-text-muted mt-1">Your request has been sent. You can check back here for updates.</p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-[#0f172a]">Your request</h1>
              <p className="guest-text-muted mt-1">{statusInfo.description}</p>
            </>
          )}
        </div>
        <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm">
          <p className="font-medium text-[#0f172a]">{ticket.room_label_snapshot}</p>
          {ticket.request_type_label_snapshot && (
            <p className="guest-text-muted capitalize">{ticket.request_type_label_snapshot}</p>
          )}
          <p className="guest-text-muted mt-1">
            Status: <span className="font-medium text-[#0f172a]">{statusInfo.label}</span>
          </p>
          {ticket.resolved_at && (
            <p className="mt-1 text-xs guest-text-muted">
              Completed {new Date(ticket.resolved_at).toLocaleString()}
            </p>
          )}
        </div>
        <p className="text-center text-xs guest-text-muted">
          This link expires in 48 hours. Bookmark it to check back.
        </p>
        <div className="flex justify-center">
          <Button asChild variant="outline" size="lg" className="min-h-12">
            <Link href="/">Done</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
