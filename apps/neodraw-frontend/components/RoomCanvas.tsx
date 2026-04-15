// components/RoomCanvas.tsx
"use client";

import { WS_URL } from "@/config";
import { useEffect, useState,useRef } from "react";
import { Canvas } from "./Canvas";

export function RoomCanvas({roomId}: {roomId: string}) {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<string>("connecting");
    const wsRef = useRef<WebSocket | null>(null);
    useEffect(() => {
        
        if (!roomId || roomId === "undefined") {
            console.error('Invalid Room ID:', roomId);
            setConnectionStatus("error");
            return;
        }

        if (wsRef.current) return;
        const token = localStorage.getItem("token");

        console.log("Connecting to WebSocket with roomId:", roomId);
        const ws = new WebSocket(`${WS_URL}?token=${token}`);        
        wsRef.current = ws;
        let isManuallyClosed = false; // 🧠 key fix

        ws.onopen = () => {
            console.log("WebSocket connected");
            const data = JSON.stringify({
                type: "join_room",
                roomId: roomId
            });
            console.log("Joining room with data:", data);
            ws.send(data);
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("Received message:", data);
                
                if (data.type === "joined_room") {
                    console.log("Successfully joined room:", data.roomId);
                    setSocket(ws);
                    setConnectionStatus("connected");
                } else if (data.type === "error") {
                    console.error("Server error:", data.message);
                    setConnectionStatus("error");
                }
            } catch (error) {
                console.error("Error parsing message:", error);
            }
        };
        
        ws.onerror = (error) => {
            if (isManuallyClosed) return; // 
            console.error("WebSocket error:", error);
            setConnectionStatus("error");
        };
        
        ws.onclose = () => {
            console.log("WebSocket disconnected");
            setSocket(null);
            setConnectionStatus("disconnected");
        };

        return () => {
            isManuallyClosed = true;
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: "leave_room",
                    roomId: roomId
                }));
            }
            ws.close();
            wsRef.current = null;
        };
    }, [roomId]);
    
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
                    <p className="mt-4">Connecting to server... ({connectionStatus})</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <Canvas roomId={roomId} socket={socket} />
        </div>
    );
}