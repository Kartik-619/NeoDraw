// components/RoomCanvas.tsx
"use client";

import { WS_URL } from "@/config";
import { useEffect, useState } from "react";
import { Canvas } from "./Canvas";

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 2000;

export function RoomCanvas({ roomId }: { roomId: string }) {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<string>("connecting");
    const [initialMembers, setInitialMembers] = useState<string[]>([]);
    const [connectionEpoch, setConnectionEpoch] = useState(0);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);

    useEffect(() => {
        let disposed = false;
        let socket: WebSocket | null = null;
        const reconnectTimer: { current: ReturnType<typeof setTimeout> | null } = { current: null };
        let attempts = 0;

        const connect = () => {
            if (disposed || socket) return;

            const token = localStorage.getItem("token");

            if (!token) {
                console.warn("No token found. Redirecting to sign in.");
                setConnectionStatus("error");
                return;
            }

            const ws = new WebSocket(`${WS_URL}?token=${token}`);
            socket = ws;

            ws.onopen = () => {
                console.log("WebSocket connected");
                attempts = 0;
                setReconnectAttempts(0);
                setInitialMembers([]);
                ws.send(JSON.stringify({
                    type: "join_room",
                    roomId
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log("Received message:", data);

                    if (data.type === "joined_room") {
                        console.log("Successfully joined room:", data.roomId);
                        if (Array.isArray(data.members)) {
                            setInitialMembers(data.members);
                        }
                        setSocket(ws);
                        setConnectionEpoch(epoch => epoch + 1);
                        setConnectionStatus("connected");
                    } else if (data.type === "error") {
                        console.error("Server error:", data.message);
                        setConnectionStatus("error");
                    }
                } catch (error) {
                    console.error("Error parsing message:", error);
                }
            };

            ws.onerror = () => {
                console.error("WebSocket error");
            };

            ws.onclose = () => {
                if (disposed) return;
                console.log("WebSocket disconnected");
                socket = null;
                setSocket(null);

                if (attempts >= MAX_RECONNECT_ATTEMPTS) {
                    setConnectionStatus("error");
                    return;
                }

                attempts += 1;
                setReconnectAttempts(attempts);
                setConnectionStatus("reconnecting");

                reconnectTimer.current = setTimeout(() => {
                    connect();
                }, RECONNECT_DELAY_MS);
            };
        };

        connect();

        return () => {
            disposed = true;
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
            }
            if (socket) {
                socket.send(JSON.stringify({
                    type: "leave_room",
                    roomId
                }));
                socket.close();
            }
            socket = null;
        };
    }, [roomId]);

    if (!roomId || roomId === "undefined") {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-red-600 text-lg font-semibold mb-2">Connection Error</div>
                    <p className="text-gray-600">Invalid room ID.</p>
                </div>
            </div>
        );
    }

    if (connectionStatus === "error") {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="text-red-600 text-lg font-semibold mb-2">Connection Error</div>
                    <p className="text-gray-600">Failed to connect to the server.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!socket) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-4">
                        {connectionStatus === "reconnecting"
                            ? `Reconnecting... (attempt ${reconnectAttempts})`
                            : `Connecting to server... (${connectionStatus})`}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <Canvas key={connectionEpoch} roomId={roomId} socket={socket} initialMembers={initialMembers} />
        </div>
    );
}
