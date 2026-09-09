"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HTTP_BACKEND } from "@/lib/config";
import { Spinner } from "@/components/Skeleton";

interface DashboardRoom {
  id: number;
  slug: string;
  editPermission: "anyone" | "admin";
}

export default function DashboardPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<DashboardRoom[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = useCallback(async (): Promise<void> => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Not authenticated");
      setRooms([]);
      return;
    }
    try {
      const res = await fetch(`${HTTP_BACKEND}/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403 || res.status === 401) {
        localStorage.removeItem("token");
        router.replace("/signin");
        return;
      }
      if (!res.ok) {
        setError("Failed to load your canvases");
        setRooms([]);
        return;
      }
      const data = (await res.json()) as { rooms: DashboardRoom[] };
      setRooms(data.rooms);
    } catch {
      setError("Network error while loading your canvases");
      setRooms([]);
    }
  }, [router]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  async function handleCreateCanvas(): Promise<void> {
    setCreating(true);
    setError(null);
    const token = localStorage.getItem("token");
    if (!token) {
      setCreating(false);
      router.push("/signin");
      return;
    }
    try {
      const res = await fetch(`${HTTP_BACKEND}/room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { roomId: number; slug: string };
      if (!res.ok || !data.slug) {
        setError("Could not create a new canvas");
        setCreating(false);
        return;
      }
      router.push(`/canvas/${data.slug}`);
    } catch {
      setError("Network error while creating your canvas");
      setCreating(false);
    }
  }

  if (error && !rooms) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 pt-16">
        <div className="text-center">
          <p className="mb-4 text-lg font-semibold text-white">{error}</p>
          <Link
            href="/signin"
            className="rounded-xl bg-white px-6 py-3 font-bold text-black transition-colors hover:bg-neutral-200"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-black px-6 pt-16 text-white">
      <div className="relative z-10 mx-auto max-w-5xl pb-20">
        <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Your <span className="text-brand">canvases</span>
            </h1>
            <p className="mt-2 text-muted">
              Pick up where you left off or start a fresh whiteboard.
            </p>
          </div>
          <button
            onClick={() => void handleCreateCanvas()}
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 font-bold text-black transition-colors hover:bg-brand-hover disabled:opacity-70"
          >
            {creating && <Spinner />}
            + New Canvas
          </button>
        </header>

        {error && (
          <p className="mb-6 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">{error}</p>
        )}

        {!rooms ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((n) => (
              <div key={n} className="h-40 animate-pulse rounded-2xl border border-white/10 bg-surface/70" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-surface/60 p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-2xl">✎</div>
            <h2 className="mb-2 text-xl font-bold">No canvases yet</h2>
            <p className="mx-auto mb-6 max-w-sm text-sm text-muted">
              Your canvases will appear here. Create your first one and start drawing together in seconds.
            </p>
            <button
              onClick={() => void handleCreateCanvas()}
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 font-bold text-black transition-colors hover:bg-brand-hover disabled:opacity-70"
            >
              {creating && <Spinner />}
              + New Canvas
            </button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room, i) => (
              <Link
                key={room.id}
                href={`/canvas/${room.slug}`}
                className="group rounded-2xl border border-white/10 bg-surface/60 p-6 transition-all hover:-translate-y-1 hover:border-white/40 hover:shadow-[0_10px_40px_rgba(255,255,255,0.08)]"
                style={{ animation: `neodrawFadeUp 0.5s ${i * 0.06}s ease both` }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-xl text-brand">
                  {room.editPermission === "admin" ? "🔒" : "✎"}
                </div>
                <h3 className="mb-1 truncate text-lg font-bold text-white">{room.slug}</h3>
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-muted">
                    {room.editPermission === "admin" ? "Admin only edits" : "Anyone can edit"}
                  </span>
                  <span className="text-sm font-semibold text-brand opacity-0 transition-opacity group-hover:opacity-100">
                    Open →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}