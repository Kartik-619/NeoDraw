"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [fading, setFading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pendingNavRef = useRef(false);

  const go = useCallback(
    (path: string) => {
      if (path === window.location.pathname) {
        setFading(true);
        window.setTimeout(() => setFading(false), 700);
        return;
      }
      pendingNavRef.current = true;
      setFading(true);
      window.setTimeout(() => {
        router.push(path);
      }, 600);
    },
    [router],
  );

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

  useEffect(() => {
    function onSceneFade(e: Event) {
      const detail = (e as CustomEvent<string> | undefined)?.detail;
      if (typeof detail === "string" && detail) go(detail);
    }
    window.addEventListener("neodraw:fade", onSceneFade);
    return () => window.removeEventListener("neodraw:fade", onSceneFade);
  }, [go]);

  useEffect(() => {
    if (!pendingNavRef.current) return;
    pendingNavRef.current = false;
    const t = window.setTimeout(() => setFading(false), 120);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = useCallback(() => {
    localStorage.removeItem("token");
    setUser(null);
    go("/");
  }, [go]);

  const onCanvas = pathname.startsWith("/canvas");

  if (onCanvas) return null;

  return (
    <>
      <div className={`scene-fade${fading ? " on" : ""}`} aria-hidden="true" />
      <header className="themed-nav fixed top-0 left-0 right-0 z-50">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="marionette-mark group" aria-label="NeoDraw home">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="9.6" stroke="#FFFFFF" strokeWidth="0.9" />
              <circle cx="11" cy="11" r="8.2" fill="#FFFFFF" />
              <circle cx="11" cy="11" r="5.4" fill="#000000" />
            </svg>
            <span className="text-base sm:text-lg font-semibold tracking-[0.18em]">
              NeoDraw
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <Link href="/" className="nav-link">
              Home
            </Link>
            <Link href="/dashboard" className="nav-link">
              Boards
            </Link>
            <Link href="/joinroom" className="nav-link">
              Join a Room
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {loading ? (
              <span className="h-8 w-24 animate-pulse bg-white/10" />
            ) : user ? (
              <>
                <span
                  title={`${user.name} — ${user.email}`}
                  className="hidden max-w-[180px] items-center gap-2 overflow-hidden rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium tracking-wide text-white/80 sm:flex"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-center text-xs font-bold text-black">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{user.name}</span>
                </span>
                <span className="nav-accent-line hidden sm:block" />
                <button onClick={handleSignOut} className="nav-btn-mobile sm:text-link" title="Sign out">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button onClick={() => go("/signin")} className="nav-btn-mobile sm:ghost-btn">
                  Sign In
                </button>
                <span className="nav-accent-line hidden sm:block" />
                <button onClick={() => go("/signup")} className="nav-btn-mobile sm:ghost-btn">
                  Sign Up
                </button>
              </>
            )}

            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="nav-hamburger md:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {mobileOpen ? (
                  <>
                    <line x1="4" y1="4" x2="20" y2="20" />
                    <line x1="20" y1="4" x2="4" y2="20" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </nav>

        <div className={`nav-mobile-menu md:hidden${mobileOpen ? " open" : ""}`}>
          <div className="nav-mobile-inner">
            <Link href="/" className="nav-mobile-link" onClick={() => setMobileOpen(false)}>
              Home
            </Link>
            <Link href="/dashboard" className="nav-mobile-link" onClick={() => setMobileOpen(false)}>
              Boards
            </Link>
            <Link href="/joinroom" className="nav-mobile-link" onClick={() => setMobileOpen(false)}>
              Join a Room
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}