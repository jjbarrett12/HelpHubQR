import type { Metadata } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/theme/ThemeScript";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3011";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "HelpHub – Housekeeping Requests",
  description: "Scan the QR in your room to request housekeeping.",
  openGraph: {
    title: "HelpHub – Housekeeping Requests",
    description: "Scan the QR in your room to request housekeeping.",
    url: "/",
    siteName: "HelpHub",
  },
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
      <body className="min-h-screen text-foreground antialiased" style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
