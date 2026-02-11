"use client";

import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#demo", label: "Demo" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/30 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-14 md:h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          <Image
            src="/helphub-logo.png"
            alt="HelpHub"
            width={200}
            height={56}
            className="h-11 w-auto object-contain sm:h-12 md:h-14"
          />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            asChild
            size="sm"
            className="rounded-lg bg-primary px-4 font-semibold text-primary-foreground shadow-sm hover:opacity-95"
          >
            <Link href={process.env.NEXT_PUBLIC_CALENDLY_URL || "#demo"} target={process.env.NEXT_PUBLIC_CALENDLY_URL ? "_blank" : undefined} rel={process.env.NEXT_PUBLIC_CALENDLY_URL ? "noopener noreferrer" : undefined}>
              See it in action
            </Link>
          </Button>
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground sm:inline-block"
          >
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}
