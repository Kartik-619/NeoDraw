"use client";

interface CanvasErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function CanvasError({ reset }: CanvasErrorProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem", background: "#ffffff", color: "#333" }}>
      <p style={{ color: "#111111" }}>Something went wrong loading this board.</p>
      <button
        onClick={reset}
        style={{ padding: "0.5rem 1.25rem", background: "#ffffff", color: "#000", border: "1px solid #000", borderRadius: "0.5rem", cursor: "pointer", fontWeight: 600 }}
      >
        Try again
      </button>
    </div>
  );
}