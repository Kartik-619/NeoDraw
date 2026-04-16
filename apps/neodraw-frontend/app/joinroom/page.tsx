"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinRoomPage() {
    const [input, setInput] = useState("");
    const router = useRouter();

    const handleJoin = () => {
        if (!input.trim()) return;

        let slug = input.trim();

        try {
            // Extract slug if full URL is pasted
            if (slug.startsWith("http")) {
                const url = new URL(slug);
                const parts = url.pathname.split("/");
                slug = parts[parts.length - 1];
            }

            router.push(`/room/${slug}`);
        } catch {
            alert("Invalid Room URL or ID");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 px-4">
            <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8 border border-gray-100">
                
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-semibold text-gray-800">
                        Join a Room
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Paste a room link or enter a room ID to start collaborating
                    </p>
                </div>

                {/* Input */}
                <div className="flex flex-col gap-4">
                    <input
                        type="text"
                        placeholder="https://yourapp.com/room/abc123"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                    />

                    {/* Button */}
                    <button
                        onClick={handleJoin}
                        className="w-full py-3 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition active:scale-[0.98]"
                    >
                        Join Room
                    </button>
                </div>

                {/* Divider */}
                <div className="my-6 flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">OR</span>
                    <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Quick Tip */}
                <p className="text-xs text-gray-500 text-center">
                    Tip: Ask your friend to share the room link using the{" "}
                    <span className="font-medium text-gray-700">Share</span> button
                </p>
            </div>
        </div>
    );
}