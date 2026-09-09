"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HTTP_BACKEND } from "@/lib/config";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      const token = localStorage.getItem("token");
      if (!token) {
        if (!cancelled) setUser(null);
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${HTTP_BACKEND}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) setUser(null);
          return;
        }
        const data = (await res.json()) as CurrentUser;
        if (!cancelled) setUser(data);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadUser();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const handleSignOut = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    router.push("/");
  }, [router]);

  const onCanvas = pathname.startsWith("/canvas");

  if (onCanvas) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-bold text-black">
            N
          </span>
          <span className="text-xl font-extrabold tracking-tight text-brand">
            NeoDraw
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {loading ? (
            <span className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
          ) : user ? (
            <>
              <span className="hidden items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand sm:flex">
                <span className="h-6 w-6 rounded-full bg-brand text-center text-xs font-bold leading-6 text-black">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                {user.name}
              </span>
              <button
                onClick={handleSignOut}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-brand hover:text-brand"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/signin"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:text-brand"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-brand px-5 py-2 text-sm font-bold text-black transition-colors hover:bg-brand-hover"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
