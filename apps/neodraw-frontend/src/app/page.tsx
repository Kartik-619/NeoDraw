import Link from "next/link";

export default function LandingPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1.5rem" }}>
      <h1 style={{ fontSize: "3rem", fontWeight: "bold" }}>NeoDraw</h1>
      <p style={{ color: "#888", fontSize: "1.1rem" }}>Real-time collaborative whiteboard</p>
      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        <Link href="/signin" style={{ padding: "0.75rem 1.5rem", background: "#6366f1", color: "white", borderRadius: "0.5rem", textDecoration: "none", fontWeight: 600 }}>
          Sign In
        </Link>
        <Link href="/signup" style={{ padding: "0.75rem 1.5rem", background: "#374151", color: "white", borderRadius: "0.5rem", textDecoration: "none", fontWeight: 600 }}>
          Sign Up
        </Link>
        <Link href="/joinroom" style={{ padding: "0.75rem 1.5rem", background: "#374151", color: "white", borderRadius: "0.5rem", textDecoration: "none", fontWeight: 600 }}>
          Join Room
        </Link>
      </div>
    </div>
  );
}
