import type { Metadata } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/theme/ThemeScript";

export const metadata: Metadata = {
  title: "HelpHub – Housekeeping Requests",
  description: "Scan the QR in your room to request housekeeping.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-[var(--app-bg)] text-foreground antialiased" style={{ background: "var(--app-bg)" }}>
        {children}
      </body>
    </html>
  );
}
