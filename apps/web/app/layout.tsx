import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeScript } from "@/components/theme/ThemeScript";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://helphubqr.com";

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
    <html lang="en" suppressHydrationWarning className={plusJakarta.variable}>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen font-sans text-foreground antialiased" style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
