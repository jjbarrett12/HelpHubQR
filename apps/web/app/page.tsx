import Link from "next/link";
import { Header } from "@/components/home/Header";
import { Footer } from "@/components/home/Footer";
import { Button } from "@/components/ui/button";
import { QrCode, Bell, LayoutDashboard, ScanLine, ClipboardList, CheckCircle2 } from "lucide-react";

/** Sleek, modern homepage – clear hierarchy, subtle depth, responsive. */
export default function HomePage() {
  return (
    <div data-help="home" className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero – minimal gradient, subtle grid, strong headline */}
        <section className="relative overflow-hidden border-b border-border/20">
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: "64px 64px",
            }}
          />
          <div
            className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl"
            aria-hidden
          />
          <div
            className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl"
            aria-hidden
          />

          <div className="container relative mx-auto px-4 py-20 sm:px-6 sm:py-24 md:py-28 lg:px-8 lg:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
                For hotels & facilities
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
                Housekeeping requests,{" "}
                <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                  simplified
                </span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Guests scan the QR in their room. Your team gets the request instantly. No phones, no clipboards.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                <Button asChild size="lg" className="w-full min-w-[160px] rounded-xl sm:w-auto">
                  <Link
                    href={process.env.NEXT_PUBLIC_CALENDLY_URL || "#demo"}
                    target={process.env.NEXT_PUBLIC_CALENDLY_URL ? "_blank" : undefined}
                    rel={process.env.NEXT_PUBLIC_CALENDLY_URL ? "noopener noreferrer" : undefined}
                  >
                    See it in action
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full min-w-[160px] rounded-xl border-2 sm:w-auto"
                >
                  <Link href="#how-it-works">How it works</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features – icons, clean cards, generous spacing */}
        <section
          id="features"
          className="relative border-b border-border/20 py-20 sm:py-24 md:py-28"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Built for hospitality
              </h2>
              <p className="mt-3 text-muted-foreground sm:text-lg">
                Everything you need to manage room requests without the hassle.
              </p>
            </div>
            <div className="mx-auto mt-14 grid max-w-5xl gap-6 sm:mt-16 sm:grid-cols-3 sm:gap-8">
              {[
                {
                  icon: QrCode,
                  title: "QR in every room",
                  description:
                    "One unique QR per room. Guests scan to request housekeeping or report issues—no app download.",
                },
                {
                  icon: Bell,
                  title: "Instant notifications",
                  description:
                    "Staff get real-time alerts and a clear list of open requests. Prioritize and resolve without missing a beat.",
                },
                {
                  icon: LayoutDashboard,
                  title: "One dashboard",
                  description:
                    "Manage multiple sites and rooms from a single place. Track trends and keep operations running smoothly.",
                },
              ].map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="group rounded-2xl border border-border/50 bg-card/50 p-6 transition hover:border-primary/20 hover:bg-card/80 sm:p-8"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works – clean steps with icons */}
        <section
          id="how-it-works"
          className="relative border-b border-border/20 py-20 sm:py-24 md:py-28"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                How it works
              </h2>
              <p className="mt-3 text-muted-foreground sm:text-lg">
                Three steps from scan to done.
              </p>
            </div>
            <div className="mx-auto mt-14 flex max-w-4xl flex-col gap-10 sm:mt-16 md:flex-row md:items-start md:justify-between md:gap-6 lg:mt-20">
              {[
                {
                  step: "1",
                  icon: ScanLine,
                  title: "Scan",
                  body: "Guest scans the QR code in their room with any phone camera.",
                },
                {
                  step: "2",
                  icon: ClipboardList,
                  title: "Request",
                  body: "They choose what they need—housekeeping, towels, or report an issue.",
                },
                {
                  step: "3",
                  icon: CheckCircle2,
                  title: "Done",
                  body: "Your team sees the request instantly and marks it complete when done.",
                },
              ].map(({ step, icon: Icon, title, body }) => (
                <div
                  key={step}
                  className="relative flex flex-1 flex-col items-center text-center md:items-center"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="mt-3 text-xs font-semibold uppercase tracking-wider text-primary">
                    Step {step}
                  </span>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 max-w-[240px] text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA – focused, minimal */}
        <section
          id="demo"
          className="relative py-20 sm:py-24 md:py-28"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl rounded-3xl border border-border/50 bg-muted/30 px-6 py-14 text-center sm:px-10 sm:py-16">
              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Ready to simplify housekeeping?
              </h2>
              <p className="mt-3 text-muted-foreground">
                Get a personalized demo and see how HelpHub works for your property.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg" className="w-full min-w-[180px] rounded-xl sm:w-auto">
                  <Link
                    href={process.env.NEXT_PUBLIC_CALENDLY_URL || "mailto:demo@helphubqr.com?subject=HelpHub%20demo%20request"}
                    target={process.env.NEXT_PUBLIC_CALENDLY_URL ? "_blank" : undefined}
                    rel={process.env.NEXT_PUBLIC_CALENDLY_URL ? "noopener noreferrer" : undefined}
                  >
                    See it in action
                  </Link>
                </Button>
                <Link
                  href="/login"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Log in to your account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
