import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "'Nunito', system-ui, sans-serif",
        background: "var(--bg, #fdf9f3)",
        color: "var(--text-primary, #2d3a30)",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🧩</div>
      <h1
        style={{
          fontFamily: "'Fredoka', sans-serif",
          fontSize: "1.8rem",
          fontWeight: 600,
          marginBottom: "0.5rem",
        }}
      >
        Page not found
      </h1>
      <p
        style={{
          color: "var(--text-secondary, #5a7060)",
          marginBottom: "2rem",
          maxWidth: "400px",
          lineHeight: 1.6,
        }}
      >
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/"
          style={{
            padding: "12px 28px",
            background: "var(--sage-500, #4d8058)",
            color: "white",
            borderRadius: "12px",
            fontSize: "1rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Go Home
        </Link>
        <Link
          href="/kid-dashboard"
          style={{
            padding: "12px 28px",
            background: "var(--card, #ffffff)",
            color: "var(--text-primary, #2d3a30)",
            border: "2px solid var(--border, #e3ede6)",
            borderRadius: "12px",
            fontSize: "1rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
