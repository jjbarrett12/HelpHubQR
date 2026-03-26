import Link from "next/link";

/**
 * High-contrast 404 page so the message is always visible
 * (avoids light-on-light when theme or CSS vars are dark/missing).
 */
export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-6"
      style={{
        background: "linear-gradient(180deg, #fef2f2 0%, #f8fafc 100%)",
        color: "#0f172a",
      }}
    >
      <p
        className="text-center text-2xl font-semibold"
        style={{ color: "#0f172a" }}
      >
        Page not found
      </p>
      <p
        className="text-center text-base"
        style={{ color: "#64748b" }}
      >
        This link may be broken or the page was removed.
      </p>
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
