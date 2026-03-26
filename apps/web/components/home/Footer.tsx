import Link from "next/link";
import Image from "next/image";

const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || "#demo";

const footerLinks = {
  Product: [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How it works" },
    { href: "#demo", label: "Get a demo" },
  ],
  Company: [
    { href: "/login", label: "Log in" },
    { href: "mailto:hello@helphubqr.com", label: "Contact" },
  ],
  Legal: [
    { href: "#", label: "Privacy" },
    { href: "#", label: "Terms" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-sky-500/20 bg-zinc-900/80">
      <div className="container mx-auto px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block">
              <Image
                src="/helphub-logo.png"
                alt="HelpHub"
                width={200}
                height={56}
                className="h-12 w-auto object-contain opacity-90 sm:h-14"
              />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-sky-200/80">
              Streamline housekeeping requests with QR codes. Guests scan, staff respond—simple and fast.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Product</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.Product.map(({ href, label }) => (
                <li key={label}>
                  {href.startsWith("http") ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-200/80 transition hover:text-white">
                      {label}
                    </a>
                  ) : (
                    <Link href={href} className="text-sm text-sky-200/80 transition hover:text-white">
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Company</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.Company.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-sky-200/80 transition hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Legal</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.Legal.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-sky-200/80 transition hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-sky-500/20 pt-8 text-center text-xs text-sky-200/60">
          © {new Date().getFullYear()} HelpHub. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
