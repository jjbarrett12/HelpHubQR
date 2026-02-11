import Link from "next/link";
import { Header } from "@/components/home/Header";
import { Footer } from "@/components/home/Footer";
import { Button } from "@/components/ui/button";

/** Black + neon blue homepage – dark background, blue accents, no hero image block. */
export default function HomePage() {
  return (
    <div data-help="home" className="flex min-h-screen flex-col bg-black">
      <Header />

      <main className="flex-1">
        {/* Hero – black, neon blue gradient on headline + CTAs */}
        <section
          className="relative overflow-hidden border-b border-sky-500/20"
          style={{
            background:
              "linear-gradient(165deg, #0a0a0a 0%, #0f172a 30%, #0c1929 50%, #0f172a 70%, #0a0a0a 100%)",
          }}
        >
          <div className="container mx-auto px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-8 lg:py-28 xl:py-32">
            <div className="mx-auto max-w-4xl text-center">
              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
                Housekeeping requests,{" "}
                <span className="gradient-text-blue">simplified</span>
              </h1>
              <p className="mt-6 text-lg text-sky-200/90 sm:text-xl md:mt-8 md:text-2xl md:leading-relaxed">
                Guests scan the QR code in their room. Your team gets the request instantly. No phones, no clipboards—just a smooth experience for everyone.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5 md:mt-12">
                <Button
                  asChild
                  size="lg"
                  className="min-w-[180px] rounded-xl bg-sky-500 px-8 py-6 text-base font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:scale-[1.02] hover:bg-sky-400 dark:bg-sky-500 dark:shadow-sky-500/25 dark:hover:bg-sky-400"
                >
                  <Link href="#demo">Get a demo</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="min-w-[180px] rounded-xl border-2 border-sky-400/80 px-8 py-6 text-base font-semibold text-sky-400 hover:bg-sky-500/10 hover:text-sky-300 dark:border-sky-400/60 dark:text-sky-400 dark:hover:bg-sky-500/10 dark:hover:text-sky-300"
                >
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features – neon blue card outlines */}
        <section
          id="features"
          className="relative border-b border-sky-500/20 py-16 sm:py-20 md:py-24 lg:py-28"
          style={{
            background: "linear-gradient(180deg, #0a0a0a 0%, #0c1929 50%, #0a0a0a 100%)",
          }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
                Built for hospitality
              </h2>
              <p className="mt-4 text-base text-sky-200/80 sm:text-lg md:mt-6 md:text-xl">
                Everything you need to manage room requests without the hassle.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-6xl gap-6 sm:mt-16 sm:grid-cols-2 sm:gap-8 lg:mt-20 lg:grid-cols-3 lg:gap-10">
              {[
                {
                  title: "QR in every room",
                  description:
                    "One unique QR per room. Guests scan to request housekeeping, amenities, or report issues—no app download required.",
                },
                {
                  title: "Instant notifications",
                  description:
                    "Staff get real-time alerts and a clear list of open requests. Prioritize and resolve without missing a beat.",
                },
                {
                  title: "One dashboard",
                  description:
                    "Manage multiple sites and rooms from a single place. Track trends, export data, and keep operations running smoothly.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="group relative rounded-2xl border-2 border-sky-400/50 bg-zinc-900/80 p-6 shadow-md shadow-sky-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/15 md:p-8"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <h3 className="relative text-xl font-bold text-white sm:text-2xl">{item.title}</h3>
                  <p className="relative mt-3 text-sm leading-relaxed text-sky-200/80 sm:mt-4 sm:text-base">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works – neon blue step circles */}
        <section
          id="how-it-works"
          className="relative border-b border-sky-500/20 py-16 sm:py-20 md:py-24 lg:py-28"
          style={{
            background: "linear-gradient(180deg, #0a0a0a 0%, #0f172a 50%, #0a0a0a 100%)",
          }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
                How it works
              </h2>
              <p className="mt-4 text-base text-sky-200/80 sm:text-lg md:mt-6 md:text-xl">
                Three steps from scan to done.
              </p>
            </div>
            <div className="mx-auto mt-12 flex max-w-5xl flex-col gap-12 sm:mt-16 md:flex-row md:items-start md:justify-between md:gap-8 lg:mt-20">
              {[
                { step: "1", title: "Scan", body: "Guest scans the QR code in their room with any phone camera." },
                { step: "2", title: "Request", body: "They choose what they need—housekeeping, towels, or report an issue." },
                { step: "3", title: "Done", body: "Your team sees the request instantly and marks it complete when done." },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex flex-1 flex-col items-center text-center md:items-center"
                >
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-lg shadow-sky-500/30 sm:h-20 sm:w-20 sm:text-3xl"
                    style={{
                      background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #0369a1 100%)",
                    }}
                  >
                    {item.step}
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-white sm:text-2xl">{item.title}</h3>
                  <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-sky-200/80 sm:text-base">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo CTA – neon blue */}
        <section
          id="demo"
          className="relative border-b border-sky-500/20 py-16 sm:py-20 md:py-24 lg:py-28"
          style={{
            background:
              "linear-gradient(150deg, hsl(199 89% 48% / 0.15) 0%, hsl(199 89% 48% / 0.08) 40%, #0c1929 100%)",
          }}
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
                Ready to simplify housekeeping?
              </h2>
              <p className="mt-4 text-base text-sky-200/80 sm:text-lg md:mt-6 md:text-xl">
                Get a personalized demo and see how HelpHub can work for your property.
              </p>
              <div className="mt-10 md:mt-12">
                <Button
                  asChild
                  size="lg"
                  className="min-w-[200px] rounded-xl bg-sky-500 px-10 py-6 text-base font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:scale-[1.02] hover:bg-sky-400 dark:bg-sky-500 dark:shadow-sky-500/25 dark:hover:bg-sky-400"
                >
                  <Link href="mailto:demo@helphub.com?subject=HelpHub%20demo%20request">
                    Get a demo
                  </Link>
                </Button>
              </div>
              <p className="mt-5 text-sm text-sky-200/70 sm:text-base">
                Or{" "}
                <Link
                  href="/login"
                  className="font-semibold text-sky-400 underline-offset-4 hover:text-sky-300"
                >
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
