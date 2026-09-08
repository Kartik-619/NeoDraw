"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { HTTP_BACKEND } from "@/lib/config";
import { Spinner } from "./Skeleton";

interface AuthPageProps {
  isSignin?: boolean;
}

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
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "320px", padding: "2rem", background: "#1e1e2e", borderRadius: "0.75rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", textAlign: "center" }}>
          {isSignin ? "Sign In" : "Sign Up"}
        </h2>

        {!isSignin && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #444", background: "#2a2a3e", color: "white" }}
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #444", background: "#2a2a3e", color: "white" }}
        />

        <input
          type="password"
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={{ padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #444", background: "#2a2a3e", color: "white" }}
        />

        {error && (
          <p role="alert" style={{ color: "#ef4444", fontSize: "0.875rem" }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "0.5rem",
            borderRadius: "0.375rem",
            background: "#6366f1",
            color: "white",
            border: "none",
            fontWeight: 600,
            cursor: submitting ? "progress" : "pointer",
            opacity: submitting ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          {submitting && <Spinner />}
          {isSignin ? "Sign In" : "Sign Up"}
        </button>
      </form>
    </div>
  );
}