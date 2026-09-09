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
    <div className="flex min-h-screen items-center justify-center px-6 pt-16">
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl border border-white/10 bg-surface/70 p-8 backdrop-blur"
      >
        <h2 className="text-center text-2xl font-extrabold text-white">Join a Room</h2>
        <p className="-mt-2 text-center text-sm text-muted">Paste a room link or slug to start collaborating</p>
        <input
          type="text"
          placeholder="Paste room link or slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "#0E0E0E",
            color: "white",
            fontSize: "0.95rem",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={joining}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black transition-colors hover:bg-brand-hover disabled:opacity-70"
        >
          {joining && <Spinner />}
          Join
        </button>
      </form>
    </div>
  );
}
