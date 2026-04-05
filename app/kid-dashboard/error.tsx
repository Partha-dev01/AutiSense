"use client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: 16,
      padding: 24,
      textAlign: "center",
    }}>
      <h2 style={{ color: "var(--text-primary)", fontSize: "1.2rem", fontWeight: 600 }}>
        Something went wrong
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: 400 }}>
        Don&apos;t worry — your progress is saved. Try refreshing or click below.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px",
          borderRadius: 12,
          border: "2px solid var(--sage-300)",
          background: "var(--sage-50)",
          color: "var(--sage-600)",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        Try again
      </button>
    </div>
  );
}
