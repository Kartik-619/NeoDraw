"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem", background: "#000000", color: "#ddd" }}>
      <p style={{ color: "#ef4444" }}>Something went wrong.</p>
      <code style={{ color: "#888", fontSize: "0.85rem", maxWidth: "40rem", textAlign: "center" }}>{error.message}</code>
      <button
        onClick={reset}
        style={{ padding: "0.5rem 1.25rem", background: "#05CE81", color: "#000", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 600 }}
      >
        Try again
      </button>
    </div>
  );
}