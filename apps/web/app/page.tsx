/** Static home – no client components, no async. Inline styles only so it always shows. */
export default function HomePage() {
  return (
    <div
      data-help="home"
      style={{
        margin: 0,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        padding: "24px",
        background: "#64748b",
        color: "#ffffff",
        border: "4px solid #0f172a",
        boxSizing: "border-box",
      }}
    >
      <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 700 }}>HelpHub</h1>
      <p style={{ margin: 0, fontSize: "16px" }}>Housekeeping requests</p>
      <a
        href="/login"
        style={{
          display: "inline-block",
          padding: "12px 24px",
          background: "#0f172a",
          color: "#fff",
          borderRadius: "8px",
          fontWeight: 600,
          textDecoration: "none",
          fontSize: "16px",
        }}
      >
        Go to login
      </a>
    </div>
  );
}
