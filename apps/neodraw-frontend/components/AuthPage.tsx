// components/AuthPage.tsx
"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation"

export function AuthPage({ isSignin }: { isSignin: boolean }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter()

    async function handleAuth() {
        setIsLoading(true);
        setError("");
        
        const endpoint = isSignin ? "signIn" : "signup";
        const body = isSignin
            ? { email, password }
            : { email, name, password };

        try {
            console.log(`Calling ${endpoint} with:`, body);
            const res = await axios.post(`http://localhost:3008/${endpoint}`, body);
            
            console.log("Response received:", res.data);
            
            if (isSignin) {
                // Check if token exists
                if (!res.data.token) {
                    throw new Error("No token received from server");
                }
                
                localStorage.setItem("token", res.data.token);
                console.log("Token stored successfully");
                
                // Check if slug exists
                if (!res.data.slug) {
                    console.error("No slug received from server. Response:", res.data);
                    throw new Error("No room slug received. Please try again.");
                }
                
                console.log("Navigating to canvas with slug:", res.data.slug);
                // Navigate to the canvas with the slug
                router.push(`/canvas/${res.data.slug}`);
            } else {
                // After signup, redirect to signin
                console.log("Signup successful, redirecting to signin");
                router.push("/signin");
            }
        } catch (error: any) {
            console.error("Authentication failed:", error);
            setError(error.response?.data?.message || error.message || "Authentication failed. Please try again.");
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen w-full bg-black text-white flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                <div className="rounded-2xl border border-white/10 bg-black p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-white text-black flex items-center justify-center">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M12 15v2m-6-4h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2zm10-4V6a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-semibold tracking-tight">
                            {isSignin ? "Welcome back" : "Create account"}
                        </h2>
                        <p className="text-white/60 mt-2 text-sm">
                            {isSignin ? "Sign in to continue" : "Start your journey"}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg text-sm border border-white/20 bg-white/5 text-white/80">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        {!isSignin && (
                            <input
                                type="text"
                                placeholder="Full name"
                                className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 placeholder-white/40 focus:border-white focus:ring-1 focus:ring-white outline-none transition"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        )}

                        <input
                            type="email"
                            placeholder="Email"
                            className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 placeholder-white/40 focus:border-white focus:ring-1 focus:ring-white outline-none transition"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <input
                            type="password"
                            placeholder="Password"
                            className="w-full px-4 py-3 rounded-xl bg-black border border-white/10 placeholder-white/40 focus:border-white focus:ring-1 focus:ring-white outline-none transition"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        <button
                            onClick={handleAuth}
                            disabled={isLoading}
                            className="w-full mt-2 py-3 rounded-xl bg-white text-black font-medium hover:bg-white/90 transition active:scale-[0.98] disabled:opacity-50"
                        >
                            {isLoading
                                ? "Processing..."
                                : isSignin
                                ? "Sign in"
                                : "Create account"}
                        </button>

                        <div className="flex items-center gap-4 my-6">
                            <div className="flex-1 h-px bg-white/10" />
                            <span className="text-xs text-white/40">OR</span>
                            <div className="flex-1 h-px bg-white/10" />
                        </div>

                        <p className="text-center text-sm text-white/60">
                            {isSignin ? "No account?" : "Already have one?"}
                            <button
                                onClick={() => {
                                    const redirectTo = isSignin ? "/signup" : "/signin";
                                    window.location.href = redirectTo;
                                }}
                                className="ml-1 text-white underline underline-offset-4 hover:text-white/80"
                            >
                                {isSignin ? "Sign up" : "Sign in"}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}