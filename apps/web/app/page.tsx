import Image from "next/image";
import Link from "next/link";
import { Header } from "@/components/home/Header";
import { Footer } from "@/components/home/Footer";
import { Button } from "@/components/ui/button";

/** Static home – header, hero, sections, footer. CTA: Get a demo. */
export default function HomePage() {
  return (
    <div data-help="home" className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-background via-background to-muted/20">
          <div className="container mx-auto px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Housekeeping requests,{" "}
                <span className="text-primary dark:text-neon">simplified</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
                Guests scan the QR code in their room. Your team gets the request instantly. No phones, no clipboards—just a smooth experience for everyone.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button asChild size="lg" className="rounded-md px-8 text-base font-semibold shadow-neon dark:shadow-neon">
                  <Link href="#demo">Get a demo</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-md px-8 text-base">
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>
            </div>
            <div className="mx-auto mt-16 max-w-5xl px-2">
              <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-muted/30 shadow-2xl dark:border-primary/20 dark:shadow-neon-sm">
                <Image
                  src="/hero-dashboard-mockup.png"
                  alt="HelpHub dashboard on MacBook and iPhone — manage housekeeping requests in real time"
                  width={1200}
                  height={675}
                  className="w-full h-auto object-contain"
                  priority
                  sizes="(max-width: 1024px) 100vw, 1024px"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b border-border/40 bg-muted/20 py-20 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Built for hospitality
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Everything you need to manage room requests without the hassle.
              </p>
            </div>
            <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "QR in every room",
                  description: "One unique QR per room. Guests scan to request housekeeping, amenities, or report issues—no app download required.",
                },
                {
                  title: "Instant notifications",
                  description: "Staff get real-time alerts and a clear list of open requests. Prioritize and resolve without missing a beat.",
                },
                {
                  title: "One dashboard",
                  description: "Manage multiple sites and rooms from a single place. Track trends, export data, and keep operations running smoothly.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md dark:border-card-border dark:shadow-neon-sm"
                >
                  <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-b border-border/40 py-20 sm:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                How it works
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Three steps from scan to done.
              </p>
            </div>
            <div className="mx-auto mt-16 flex max-w-4xl flex-col gap-12 md:flex-row md:justify-between md:gap-8">
              {[
                { step: "1", title: "Scan", body: "Guest scans the QR code in their room with any phone camera." },
                { step: "2", title: "Request", body: "They choose what they need—housekeeping, towels, or report an issue." },
                { step: "3", title: "Done", body: "Your team sees the request instantly and marks it complete when done." },
              ].map((item) => (
                <div key={item.step} className="flex flex-1 flex-col items-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-lg font-bold text-primary dark:border-neon dark:bg-primary/20 dark:text-neon">
                    {item.step}
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo CTA */}
        <section id="demo" className="border-b border-border/40 bg-primary/5 py-20 sm:py-24 dark:bg-primary/10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Ready to simplify housekeeping?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Get a personalized demo and see how HelpHub can work for your property.
              </p>
              <div className="mt-10">
                <Button asChild size="lg" className="rounded-md px-10 text-base font-semibold shadow-neon dark:shadow-neon">
                  <Link href="mailto:demo@helphub.com?subject=HelpHub%20demo%20request">Get a demo</Link>
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Or{" "}
                <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline dark:text-neon">
                  log in
                </Link>{" "}
                if you already have an account.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
