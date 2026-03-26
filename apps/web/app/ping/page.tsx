/**
 * Public test route – no route group. Use to verify public routes are deployed.
 * Open: https://helphubqr.com/ping
 */
export default function PingPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-6"
      style={{
        background: "linear-gradient(180deg, #fef2f2 0%, #f8fafc 100%)",
        color: "#0f172a",
      }}
    >
      <p className="text-xl font-semibold" style={{ color: "#0f172a" }}>
        Public access works.
      </p>
      <p className="text-sm" style={{ color: "#64748b" }}>
        QR routes (/t/..., /q/...) use the same public access.
      </p>
    </div>
  );
}
