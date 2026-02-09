"use client";

import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "/login", label: "Log in" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full overflow-visible border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 overflow-visible">
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src="/helphub-logo.png"
            alt="HelpHub"
            width={420}
            height={120}
            className="h-24 w-auto object-contain object-center"
          />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button asChild size="default" className="rounded-md font-semibold">
            <Link href="#demo">Get a demo</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
