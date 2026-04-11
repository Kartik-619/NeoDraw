// components/AuthPage.tsx
"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation"
import { HTTP_BACKEND } from "@/config";

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
            const res = await axios.post(`${HTTP_BACKEND}/${endpoint}`, body);
            
            console.log("Response received:", res.data);
            
            if (isSignin) {
                if (!res.data.token) {
                    throw new Error("No token received from server");
                }
                
                localStorage.setItem("token", res.data.token);
                console.log("Token stored successfully");
                
                if (!res.data.slug) {
                    console.error("No slug received from server. Response:", res.data);
                    throw new Error("No room slug received. Please try again.");
                }
                
                console.log("Navigating to canvas with slug:", res.data.slug);
                router.push(`/canvas/${res.data.slug}`);
            } else {
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
        <div className="min-h-screen w-full bg-black flex items-center justify-center px-4 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Main white card */}
                <div className="rounded-2xl bg-white shadow-2xl overflow-hidden transform transition-all duration-500 hover:scale-[1.02]">
                    {/* Decorative top bar */}
                    <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"></div>
                    
                    <div className="p-8">
                        <div className="text-center mb-8">
                            {/* Logo/Icon container with gradient */}
                            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 text-white flex items-center justify-center shadow-lg">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                        d="M12 15v2m-6-4h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2zm10-4V6a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            
                            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                                {isSignin ? "Welcome back" : "Create account"}
                            </h2>
                            <p className="text-gray-500 mt-2 text-sm">
                                {isSignin ? "Sign in to continue your journey" : "Start your creative journey today"}
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700 animate-shake">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    {error}
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            {!isSignin && (
                                <div className="group">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        placeholder="John Doe"
                                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20 outline-none transition-all duration-200"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="group">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    placeholder="you@example.com"
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20 outline-none transition-all duration-200"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div className="group">
                                <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:ring-opacity-20 outline-none transition-all duration-200"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <button
                                onClick={handleAuth}
                                disabled={isLoading}
                                className="w-full mt-4 py-3 rounded-lg bg-black text-white font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                            >
                                {isLoading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Processing...
                                    </div>
                                ) : (isSignin ? "Sign in" : "Create account")}
                            </button>

                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-3 bg-white text-gray-500">Or continue with</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button className="py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Google
                                </button>
                                <button className="py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center justify-center gap-2">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.03-2.682-.103-.253-.447-1.27.098-2.646 0 0 .84-.269 2.75 1.025.8-.223 1.65-.334 2.5-.334.85 0 1.7.111 2.5.334 1.91-1.294 2.75-1.025 2.75-1.025.545 1.376.201 2.393.099 2.646.64.698 1.03 1.591 1.03 2.682 0 3.841-2.337 4.687-4.565 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                                    </svg>
                                    GitHub
                                </button>
                            </div>

                            <p className="text-center text-sm text-gray-600 mt-6">
                                {isSignin ? "No account?" : "Already have one?"}
                                <button
                                    onClick={() => {
                                        const redirectTo = isSignin ? "/signup" : "/signin";
                                        window.location.href = redirectTo;
                                    }}
                                    className="ml-1 text-purple-600 font-medium hover:text-purple-700 hover:underline transition-colors"
                                >
                                    {isSignin ? "Sign up" : "Sign in"}
                                </button>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

           
          
        </div>
    );
}