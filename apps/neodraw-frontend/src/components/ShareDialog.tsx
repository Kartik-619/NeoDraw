"use client";

import { useState } from "react";
import type { EditPermission } from "@repo/shared-types";
import { updateRoomPermission } from "@/draw/http";

interface ShareDialogProps {
  roomSlug: string;
  isAdmin: boolean;
  editPermission: EditPermission;
  onPermissionChange: (permission: EditPermission) => void;
  onClose: () => void;
}

export function ShareDialog({ roomSlug, isAdmin, editPermission, onPermissionChange, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleCopyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }

  async function handlePermissionChange(permission: EditPermission): Promise<void> {
    if (!isAdmin) return;
    setSaving(true);
    const ok = await updateRoomPermission(roomSlug, permission);
    if (ok) {
      onPermissionChange(permission);
    }
    setSaving(false);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#0E0E0E",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          width: "24rem",
          maxWidth: "90vw",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          color: "#ddd",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>Share this room</h2>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            readOnly
            value={window.location.href}
            style={{
              flex: 1,
              padding: "0.5rem 0.75rem",
              background: "#111111",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "0.375rem",
              color: "#ddd",
              fontSize: "0.875rem",
            }}
          />
          <button
            onClick={handleCopyLink}
            style={{
              padding: "0.5rem 0.75rem",
              background: "#05CE81",
              color: "#000",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.9rem", cursor: isAdmin ? "pointer" : "default" }}>
            <input
              type="radio"
              name="editPermission"
              checked={editPermission === "anyone"}
              disabled={!isAdmin}
              onChange={() => handlePermissionChange("anyone")}
            />
            Anyone with the link can edit
          </label>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.9rem", cursor: isAdmin ? "pointer" : "default" }}>
            <input
              type="radio"
              name="editPermission"
              checked={editPermission === "admin"}
              disabled={!isAdmin}
              onChange={() => handlePermissionChange("admin")}
            />
            Only the owner can edit
          </label>
        </div>

        {!isAdmin && (
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#888" }}>
            This room is currently <b>{editPermission === "admin" ? "view-only for others" : "open to editing by anyone with the link"}</b>.
            Only the room owner can change this.
          </p>
        )}

        {saving && <p style={{ margin: 0, fontSize: "0.8rem", color: "#888" }}>Saving…</p>}

        <button
          onClick={onClose}
          style={{
            padding: "0.5rem",
            background: "rgba(255,255,255,0.1)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "0.375rem",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}