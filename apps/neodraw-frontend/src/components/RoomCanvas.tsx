"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { EditPermission, RoomInfo, ServerShapeMessage } from "@repo/shared-types";
import { WS_URL } from "@/lib/config";
import { getCurrentUserId } from "@/lib/jwt";
import { Canvas } from "./Canvas";
import { CanvasSkeleton } from "./Skeleton";

interface RoomCanvasProps {
  roomId: string;
}

type ConnectionState = "connected" | "reconnecting";

export function RoomCanvas({ roomId }: RoomCanvasProps) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connected");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [editPermission, setEditPermission] = useState<EditPermission>("anyone");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const reconnectCount = useRef(0);
  const mountedRef = useRef(true);
  const wsRef = useRef<WebSocket | null>(null);
  const deniedRef = useRef(false);

  useEffect(() => {
    setCurrentUserId(getCurrentUserId());
  }, []);
  const isAdmin = Boolean(currentUserId && roomInfo && roomInfo.adminId === currentUserId);

  const openSocket = useCallback((keepAlive = false): void => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setError("Not authenticated — please sign in again");
      setLoading(false);
      return;
    }

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectCount.current = 0;
      setReconnectAttempt(0);
      setConnectionState("connected");
      ws.send(JSON.stringify({ type: "join_room", roomId }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerShapeMessage;

      if (msg.type === "join_denied") {
        deniedRef.current = true;
        setError("You don't have access to this canvas");
        setLoading(false);
        ws.close();
        return;
      }

      if (msg.type === "joined_room") {
        setMembers(msg.members);
        setSocket(ws);
        setLoading(false);
        setConnectionState("connected");
        setRoomInfo(msg.room);
        setEditPermission(msg.room.editPermission);
        setConnectionEpoch((e) => e + 1);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current || !keepAlive || deniedRef.current) return;
      if (reconnectCount.current < 10) {
        reconnectCount.current++;
        setReconnectAttempt(reconnectCount.current);
        setConnectionState("reconnecting");
        setTimeout(() => {
          if (mountedRef.current && keepAlive) openSocket(keepAlive);
        }, 2000);
      } else {
        setError("Connection lost. Please refresh.");
        setLoading(false);
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error");
    };
  }, [roomId]);

  useEffect(() => {
    mountedRef.current = true;
    deniedRef.current = false;
    openSocket(true);

    return () => {
      mountedRef.current = false;
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave_room", roomId }));
        ws.close();
      }
      wsRef.current = null;
    };
  }, [openSocket, roomId]);

  function handleRetry(): void {
    const ws = wsRef.current;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      ws.close();
    }
    deniedRef.current = false;
    setError(null);
    setLoading(true);
    reconnectCount.current = 0;
    openSocket(true);
  }

  function handlePermissionChange(permission: EditPermission): void {
    setEditPermission(permission);
  }

  if (loading) {
    return <CanvasSkeleton />;
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", gap: "1rem", background: "#ffffff" }}>
        <p style={{ color: "#111111", fontSize: "1rem" }}>{error}</p>
        <button onClick={handleRetry} style={{ padding: "0.5rem 1rem", background: "#ffffff", color: "#000", border: "1px solid #000", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600 }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <Canvas
      key={connectionEpoch}
      roomId={roomId}
      socket={socket!}
      initialMembers={members}
      isAdmin={isAdmin}
      editPermission={editPermission}
      isReconnecting={connectionState === "reconnecting"}
      reconnectAttempt={reconnectAttempt}
      onPermissionChange={handlePermissionChange}
    />
  );
}