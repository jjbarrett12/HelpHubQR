import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "@/components/join/AcceptInviteForm";

export const metadata = {
  title: "Accept invite · HelpHubQR",
};

export default async function JoinPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen flex flex-col items-center justify-start pt-[10vh] p-4 bg-muted/30">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Join a tenant</h1>
          <p className="text-sm text-muted-foreground">Accept an invite to access customer sites and tickets.</p>
        </div>
        <AcceptInviteForm isAuthed={Boolean(user)} />
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/app/today" className="underline underline-offset-2 hover:text-foreground">
            Back to app
          </Link>
        </p>
      </div>
    </main>
  );
}
