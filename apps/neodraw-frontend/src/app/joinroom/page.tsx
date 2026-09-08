"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Skeleton";

export default function JoinRoomPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [joining, setJoining] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setJoining(true);
    // Extract slug from URL or use as-is
    let extracted = slug.trim();
    if (extracted.includes("/canvas/")) {
      extracted = extracted.split("/canvas/").pop() || "";
    }
    if (extracted) {
      router.push(`/canvas/${extracted}`);
    } else {
      setJoining(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "400px", padding: "2rem", background: "#1e1e2e", borderRadius: "0.75rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", textAlign: "center" }}>Join a Room</h2>
        <input
          type="text"
          placeholder="Paste room link or slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          style={{ padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #444", background: "#2a2a3e", color: "white" }}
        />
        <button
          type="submit"
          disabled={joining}
          style={{
            padding: "0.5rem",
            borderRadius: "0.375rem",
            background: "#6366f1",
            color: "white",
            border: "none",
            fontWeight: 600,
            cursor: joining ? "progress" : "pointer",
            opacity: joining ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          {joining && <Spinner />}
          Join
        </button>
      </form>
    </div>
  );
}
