"use client";

import { useEffect, useRef, useState } from "react";
import type { EditPermission, Tool } from "@repo/shared-types";
import { Game, PRESET_COLORS } from "@/draw/Game";
import type { HistoryState } from "@/draw/Game";
import { exportPng, exportSvg } from "@/draw/export";
import { IconButton } from "./IconButton";
import { ShareDialog } from "./ShareDialog";
import { ErrorBoundary } from "./ErrorBoundary";

interface CanvasProps {
  roomId: string;
  socket: WebSocket;
  initialMembers: string[];
  isAdmin: boolean;
  editPermission: EditPermission;
  isReconnecting: boolean;
  reconnectAttempt: number;
  onPermissionChange: (permission: EditPermission) => void;
}

const tools: Tool[] = ["rect", "circle", "diamond", "pencil", "text", "select", "eraser"];

export function Canvas({ roomId, socket, initialMembers, isAdmin, editPermission, isReconnecting, reconnectAttempt, onPermissionChange }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [memberCount, setMemberCount] = useState(initialMembers.length);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [color, setColor] = useState("#000000");
  const [zoom, setZoom] = useState(1);
  const [canUndoRedo, setCanUndoRedo] = useState<HistoryState>({ canUndo: false, canRedo: false });
  const [showShare, setShowShare] = useState(false);

  const isViewOnly = editPermission === "admin" && !isAdmin;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new Game(canvas, roomId, socket);
    gameRef.current = game;
    game.onHistoryChange = () => setCanUndoRedo(game.getHistoryState());
    game.init();

    const handleResize = () => game.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      game.destroy();
      gameRef.current = null;
    };
  }, [roomId, socket]);

  useEffect(() => {
    if (!gameRef.current) return;
    gameRef.current.setReadOnly(isViewOnly);
    gameRef.current.setTool(isViewOnly ? "select" : activeTool);
    setActiveTool((prev) => (isViewOnly ? "select" : prev));
  }, [activeTool, isViewOnly, roomId, socket]);

  useEffect(() => {
    if (!gameRef.current) return;
    gameRef.current.setColor(color);
  }, [color]);

  useEffect(() => {
    if (!gameRef.current) return;
    setZoom(gameRef.current.getZoom());
  }, [roomId, socket]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "user_joined" || msg.type === "user_left") {
          setMemberCount((c) => msg.type === "user_joined" ? c + 1 : Math.max(0, c - 1));
        }
        if (msg.type === "joined_room") {
          setMemberCount(msg.members.length);
        }
      } catch { /* ignore */ }
    }

    socket.addEventListener("message", handleMessage);
    return () => socket.removeEventListener("message", handleMessage);
  }, [socket]);

  const cursorMap: Record<Tool, string> = {
    rect: "crosshair",
    circle: "crosshair",
    diamond: "crosshair",
    pencil: "crosshair",
    text: "text",
    select: "default",
    eraser: "crosshair",
  };

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
  }

  function handleToolChange(tool: Tool) {
    setActiveTool(tool);
  }

  function handleUndo() {
    gameRef.current?.undo();
    if (gameRef.current) setCanUndoRedo(gameRef.current.getHistoryState());
  }

  function handleRedo() {
    gameRef.current?.redo();
    if (gameRef.current) setCanUndoRedo(gameRef.current.getHistoryState());
  }

  function handleZoomIn() {
    gameRef.current?.zoomIn();
    if (gameRef.current) setZoom(gameRef.current.getZoom());
  }

  function handleZoomOut() {
    gameRef.current?.zoomOut();
    if (gameRef.current) setZoom(gameRef.current.getZoom());
  }

  function handleResetZoom() {
    gameRef.current?.resetZoom();
    if (gameRef.current) setZoom(gameRef.current.getZoom());
  }

  function handleExportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    exportPng(canvas, roomId);
  }

  function handleExportSvg() {
    const game = gameRef.current;
    if (!game) return;
    exportSvg(game.exportShapes(), roomId);
  }

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "#000000" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", padding: "0.5rem 1rem", gap: "0.5rem", background: "#0A0A0A", borderBottom: "1px solid rgba(255,255,255,0.12)", zIndex: 10 }}>
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
          {tools.map((tool) => (
            <IconButton
              key={tool}
              label={tool}
              active={activeTool === tool}
              disabled={isViewOnly && tool !== "select"}
              onClick={() => handleToolChange(tool)}
            />
          ))}
        </div>

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.12)", margin: "0 0.25rem" }} />

        <IconButton label="undo" disabled={!canUndoRedo.canUndo} onClick={handleUndo} />
        <IconButton label="redo" disabled={!canUndoRedo.canRedo} onClick={handleRedo} />

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.12)", margin: "0 0.25rem" }} />

        <IconButton label="zoom-out" onClick={handleZoomOut} />
        <button
          onClick={handleResetZoom}
          title="Reset zoom (Ctrl+0)"
          style={{ padding: "0.25rem 0.5rem", background: "transparent", color: "#aaa", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.75rem", minWidth: "3rem" }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconButton label="zoom-in" onClick={handleZoomIn} />

        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.12)", margin: "0 0.25rem" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <input
            type="color"
            value={color}
            disabled={isViewOnly}
            onChange={(e) => setColor(e.target.value)}
            title="Stroke color"
            style={{ width: 28, height: 28, padding: 0, border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", background: "transparent", cursor: isViewOnly ? "not-allowed" : "pointer" }}
          />
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              disabled={isViewOnly}
              onClick={() => setColor(c)}
              title={c}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: c,
                border: color === c ? "2px solid #05CE81" : "1px solid rgba(255,255,255,0.3)",
                cursor: isViewOnly ? "not-allowed" : "pointer",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.25rem" }}>
          <button onClick={handleExportPng} title="Export as PNG" style={{ padding: "0.375rem 0.625rem", background: "transparent", color: "#aaa", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8rem" }}>
            PNG
          </button>
          <button onClick={handleExportSvg} title="Export as SVG" style={{ padding: "0.375rem 0.625rem", background: "transparent", color: "#aaa", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8rem" }}>
            SVG
          </button>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "1rem" }}>
          {isViewOnly && (
            <span style={{ color: "#fbbf24", fontSize: "0.875rem", padding: "0.25rem 0.6rem", background: "rgba(251,191,36,0.12)", borderRadius: "999px" }}>
              View only
            </span>
          )}
          {isReconnecting && (
            <span style={{ color: "#fbbf24", fontSize: "0.875rem", padding: "0.25rem 0.6rem", background: "rgba(251,191,36,0.12)", borderRadius: "999px" }}>
              Reconnecting{reconnectAttempt > 1 ? `… (${reconnectAttempt})` : "…"}
            </span>
          )}
          <span style={{ color: "#888", fontSize: "0.875rem" }}>{memberCount} online</span>
          <button onClick={handleCopyLink} style={{ padding: "0.375rem 0.75rem", background: "#1F1F1F", color: "white", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem" }}>
            {copiedSlug ? "Copied!" : "Copy Link"}
          </button>
          <button onClick={() => setShowShare(true)} style={{ padding: "0.375rem 0.75rem", background: "#05CE81", color: "black", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
            Share
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: "relative", background: "#ffffff" }}>
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block", cursor: cursorMap[activeTool], background: "#ffffff" }}
        />
        {isViewOnly && (
          <span
            style={{
              position: "absolute",
              bottom: "1rem",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              fontSize: "0.8rem",
              padding: "0.35rem 0.75rem",
              borderRadius: "999px",
            }}
          >
            View-only mode — scroll to zoom, drag with middle mouse or Space to pan
          </span>
        )}
      </div>

      {showShare && (
        <ErrorBoundary onReset={() => setShowShare(false)}>
          <ShareDialog
            roomSlug={roomId}
            isAdmin={isAdmin}
            editPermission={editPermission}
            onPermissionChange={onPermissionChange}
            onClose={() => setShowShare(false)}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}