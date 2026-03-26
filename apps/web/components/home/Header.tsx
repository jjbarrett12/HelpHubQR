"use client";

import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#demo", label: "Get a demo" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full overflow-visible border-b border-sky-500/20 bg-black/95 backdrop-blur supports-[backdrop-filter]:bg-black/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 overflow-visible">
        <Link href="/" className="flex items-center shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-md">
          <Image
            src="/helphub-logo.png"
            alt="HelpHub"
            width={560}
            height={160}
            className="h-32 w-auto object-contain object-center md:h-40"
          />
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-sky-200/90 transition-colors hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            asChild
            size="default"
            className="rounded-md bg-sky-500 font-semibold text-white shadow-lg shadow-sky-500/25 hover:bg-sky-400"
          >
            <Link href="#demo">Get a demo</Link>
          </Button>
          <Link
            href="/login"
            className="text-sm font-medium text-sky-200/90 hover:text-white"
          >
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}
