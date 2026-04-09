// components/RoomCanvas.tsx
"use client";

import { WS_URL } from "@/config";
import { useEffect, useRef, useState } from "react";
import { Canvas } from "./Canvas";

export function RoomCanvas({roomId}: {roomId: string}) {
    const [socket, setSocket] = useState<WebSocket | null>(null);

    useEffect(() => {
        if (!roomId) {
            console.error('Room ID is required for WebSocket connection');
            return;
          }
          
        const token = localStorage.getItem("token");
            if (!token) {
            console.error("No token found");
            return;
        }

        const ws = new WebSocket(`${WS_URL}?token=${token}`);
        
        ws.onopen = () => {
            console.log("WebSocket connected");
            setSocket(ws);
            const data = JSON.stringify({
                type: "join_room",
                roomId: roomId // This is the slug
            });
            console.log("Joining room with data:", data);
            ws.send(data);
        };
        
        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
        
        ws.onclose = () => {
            console.log("WebSocket disconnected");
        };

        return () => {
            ws.close();
        };
    }, [roomId]); // Add roomId to dependency array
   
    if (!socket) {
        return <div>Connecting to server....</div>;
    }

    return <div>
        <Canvas roomId={roomId} socket={socket} />
    </div>;
}