import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#f8fafc",
};

export const metadata: Metadata = {
  title: "Request service",
  description: "Scan the QR to request housekeeping or report an issue.",
};

/**
 * Public/guest layout: always light theme, mobile-safe area, high contrast.
 * Prevents blank black screen when device is in dark mode.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="guest-theme">
      {children}
    </div>
  );
}
