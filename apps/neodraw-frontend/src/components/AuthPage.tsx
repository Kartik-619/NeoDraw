"use client";

import { useState } from "react";
import type { FormEvent, CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HTTP_BACKEND } from "@/lib/config";
import { Spinner } from "./Skeleton";

interface AuthPageProps {
  isSignin?: boolean;
}

const inputStyle: CSSProperties = {
  padding: "0.75rem 1rem",
  borderRadius: "0.75rem",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#0E0E0E",
  color: "white",
  fontSize: "0.95rem",
  outline: "none",
};

export function AuthPage({ isSignin = false }: AuthPageProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const endpoint = isSignin ? "/signIn" : "/signup";
    const body: Record<string, string> = { email, password };
    if (!isSignin) body.name = name;

    try {
      const res = await fetch(`${HTTP_BACKEND}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as Record<string, string>;

      if (!res.ok) {
        setError(data["message"] || "Something went wrong");
        return;
      }

      if (isSignin) {
        const token = data["token"];
        const slug = data["slug"];
        if (!token || !slug) {
          setError("Missing sign-in data");
          return;
        }
        localStorage.setItem("token", token);
        router.push(`/canvas/${slug}`);
      } else {
        router.push("/signin");
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 pt-16">
      {/* ambient glow */}
      <div className="pointer-events-none fixed left-1/2 top-[-10rem] h-96 w-96 -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]" />

      <form
        onSubmit={handleSubmit}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-white/10 bg-surface/70 p-8 backdrop-blur"
      >
        <div className="mb-2 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-2xl font-extrabold text-black">
            N
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            {isSignin ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {isSignin ? "Sign in to your NeoDraw workspace" : "Start drawing together in seconds"}
          </p>
        </div>

        {!isSignin && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={inputStyle}
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={inputStyle}
        />

        {error && (
          <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-bold text-black transition-colors hover:bg-brand-hover disabled:opacity-70"
        >
          {submitting && <Spinner />}
          {isSignin ? "Sign In" : "Create Account"}
        </button>

        <p className="text-center text-sm text-muted">
          {isSignin ? (
            <>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-semibold text-brand hover:underline">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/signin" className="font-semibold text-brand hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
