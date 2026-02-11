import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  return (
    <div className="min-h-full">
      <header className="border-b border-border/50 bg-[var(--app-bg)]/80 backdrop-blur-md px-6 py-5">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Help</h1>
        </div>
      </header>
      <div className="p-6 md:p-8 max-w-2xl space-y-6">
        <Card className="premium-card">
          <CardHeader className="pb-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BookOpen className="h-5 w-5 text-primary" />
              Documentation
            </h2>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Learn how to set up sites, add rooms and QR codes, and manage tickets. Check the{" "}
              <a
                href="https://github.com/jjbarrett12/HelpHubQR#readme"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                README
              </a>{" "}
              for setup and the pilot onboarding checklist in the app (Property – MVP config → Pilot onboarding).
            </p>
          </CardContent>
        </Card>
        <Card className="premium-card">
          <CardHeader className="pb-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Mail className="h-5 w-5 text-primary" />
              Contact support
            </h2>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p className="mb-3">
              Need help or want a demo? Reach out and we’ll get back to you.
            </p>
            <Button asChild size="sm" className="gap-2">
              <a href="mailto:hello@helphubqr.com?subject=HelpHub%20support">
                <Mail className="h-4 w-4" />
                hello@helphubqr.com
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
