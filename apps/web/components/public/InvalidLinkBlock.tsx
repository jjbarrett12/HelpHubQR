import Link from "next/link";

/**
 * Shown when the URL path is valid but the token/QR is invalid or expired.
 * High-contrast so it’s always readable (e.g. on mobile after a scan).
 */
export function InvalidLinkBlock({
  message = "This link is invalid or expired.",
  hint,
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6"
      style={{
        background: "linear-gradient(180deg, #fef2f2 0%, #f8fafc 100%)",
        color: "#0f172a",
      }}
    >
      <p className="text-center text-xl font-semibold" style={{ color: "#0f172a" }}>
        {message}
      </p>
      {hint && (
        <p
          className="mx-auto max-w-sm px-4 text-center text-sm sm:max-w-md md:max-w-xl"
          style={{ color: "#64748b" }}
        >
          {hint}
        </p>
      )}
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/"
          className="rounded-lg border border-[#e2e8f0] bg-white px-6 py-3 text-base font-medium shadow-sm transition hover:bg-[#f8fafc]"
          style={{ color: "#0f172a" }}
        >
          Go to home
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-[#dc2626] bg-[#dc2626] px-6 py-3 text-base font-medium text-white shadow-sm transition hover:bg-[#b91c1c]"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
