import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    notFound();
  }

  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, status, room_label_snapshot, request_type, created_at, resolved_at")
    .eq("id", row.ticket_id)
    .single();

  if (!ticket) {
    notFound();
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
    <main className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          {justSubmitted ? (
            <>
              <h1 className="text-xl font-semibold">Thank you</h1>
              <p className="text-muted-foreground">
                Your request has been sent. You can check back here for updates.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Your request</h1>
              <p className="text-muted-foreground">{statusInfo.description}</p>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Room {ticket.room_label_snapshot}</p>
            {ticket.request_type && (
              <p className="text-muted-foreground capitalize">{ticket.request_type}</p>
            )}
            <p className="mt-1 text-muted-foreground">
              Status: <span className="font-medium text-foreground">{statusInfo.label}</span>
            </p>
            {ticket.resolved_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                Completed {new Date(ticket.resolved_at).toLocaleString()}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            This link expires in 48 hours. Bookmark it to check back.
          </p>
          <div className="flex justify-center">
            <Button asChild variant="outline" size="sm">
              <Link href="/">Done</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
