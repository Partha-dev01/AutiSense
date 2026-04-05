export default function Loading() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: 16,
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: "4px solid var(--sage-200)",
        borderTopColor: "var(--sage-500)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Loading...</p>
    </div>
  );
}
