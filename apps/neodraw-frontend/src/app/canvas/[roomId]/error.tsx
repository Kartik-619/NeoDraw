"use client";

interface CanvasErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CanvasError({ reset }: CanvasErrorProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem", background: "#1a1a2e", color: "#ddd" }}>
      <p style={{ color: "#ef4444" }}>Something went wrong loading this board.</p>
      <button
        onClick={reset}
        style={{ padding: "0.5rem 1rem", background: "#6366f1", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer" }}
      >
        Try again
      </button>
    </div>
  );
}