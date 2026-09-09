"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { HTTP_BACKEND } from "@/lib/config";
import { Spinner } from "./Skeleton";

type AuthMode = "signin" | "signup";

interface AuthPageProps {
  initialMode?: AuthMode;
}

export function AuthPage({ initialMode = "signin" }: AuthPageProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const isSignin = mode === "signin";

  function switchMode(next: AuthMode): void {
    if (next === mode) return;
    setMode(next);
    setShowPassword(false);
    setError("");
    setErrorKey((k) => k + 1);
  }

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
        setErrorKey((k) => k + 1);
        return;
      }

      if (isSignin) {
        const token = data["token"];
        if (!token) {
          setError("Missing sign-in data");
          setErrorKey((k) => k + 1);
          return;
        }
        localStorage.setItem("token", token);
        router.push("/dashboard");
      } else {
        setPassword("");
        switchMode("signin");
      }
    } catch {
      setError("Network error");
      setErrorKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page flex min-h-screen items-center justify-center px-6 pt-16">
      <form onSubmit={handleSubmit} className="auth-card">
        <div className="auth-mark">N</div>

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={isSignin}
            className={`auth-tab${isSignin ? " active" : ""}`}
            onClick={() => switchMode("signin")}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!isSignin}
            className={`auth-tab${!isSignin ? " active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            Sign Up
          </button>
        </div>

        <div key={mode} className="auth-form auth-tab-content">
          {!isSignin && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-name">
                Name
              </label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                placeholder="How we should greet you"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="auth-input"
              />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">
              Password
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignin ? "current-password" : "new-password"}
                placeholder={isSignin ? "Your password" : "Min 8 characters"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="auth-input auth-input--pwd"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
                className="auth-eye"
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24M14.5 12.5l5.5 5.5M4 4l16 16" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p key={errorKey} role="alert" className="auth-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="primary-btn mt-1 flex w-full items-center justify-center gap-2"
          >
            {submitting && <Spinner />}
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}