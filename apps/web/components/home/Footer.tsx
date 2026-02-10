import Link from "next/link";
import Image from "next/image";

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
    <footer className="border-t border-border/30 bg-muted/20">
      <div className="container mx-auto px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block">
              <Image
                src="/helphub-logo.png"
                alt="HelpHub"
                width={140}
                height={40}
                className="h-8 w-auto object-contain opacity-90"
              />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Streamline housekeeping requests with QR codes. Guests scan, staff respond—simple and fast.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Product</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.Product.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-muted-foreground transition hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Company</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.Company.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-muted-foreground transition hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Legal</h3>
            <ul className="mt-4 space-y-3">
              {footerLinks.Legal.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-muted-foreground transition hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-border/30 pt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} HelpHub. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
