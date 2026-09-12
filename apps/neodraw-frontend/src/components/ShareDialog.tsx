"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { EditPermission } from "@repo/shared-types";
import {
  addRoomMember,
  listRoomMembers,
  removeRoomMember,
  updateRoomPermission,
  type RoomMemberView,
} from "@/draw/http";

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
  const [members, setMembers] = useState<RoomMemberView[]>([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberMsg, setMemberMsg] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [memberBusy, setMemberBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, roomSlug]);

  async function loadMembers(): Promise<void> {
    const list = await listRoomMembers(roomSlug);
    setMembers(list);
  }

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

  async function handleAddMember(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!isAdmin) return;
    setMemberBusy(true);
    setMemberMsg(null);
    const email = memberEmail.trim();
    const result = await addRoomMember(roomSlug, email);
    if (result.ok) {
      setMemberEmail("");
      setMemberMsg({ kind: "info", text: "Added. They can now open this canvas." });
      await loadMembers();
    } else {
      setMemberMsg({ kind: "error", text: result.message ?? "Could not add member" });
    }
    setMemberBusy(false);
  }

  async function handleRemoveMember(userId: string): Promise<void> {
    const ok = await removeRoomMember(roomSlug, userId);
    if (ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    }
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

        {isAdmin && (
          <form onSubmit={handleAddMember} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="email"
              placeholder="Invite a member by email"
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              disabled={memberBusy}
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
              type="submit"
              disabled={memberBusy || memberEmail.trim() === ""}
              style={{
                padding: "0.5rem 0.75rem",
                background: "#ffffff",
                color: "#000",
                border: "1px solid #ffffff",
                borderRadius: "0.375rem",
                cursor: memberBusy || memberEmail.trim() === "" ? "not-allowed" : "pointer",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              {memberBusy ? "Adding…" : "Add"}
            </button>
          </form>
        )}

        {memberMsg && (
          <p style={{ margin: 0, fontSize: "0.8rem", color: memberMsg.kind === "error" ? "#f87171" : "#4ade80" }}>
            {memberMsg.text}
          </p>
        )}

        {isAdmin && members.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {members.map((m) => (
              <div
                key={m.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.4rem 0.6rem",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</span>
                <button
                  onClick={() => void handleRemoveMember(m.userId)}
                  title={`Remove ${m.email}`}
                  style={{
                    padding: "0.15rem 0.5rem",
                    background: "transparent",
                    color: "#f87171",
                    border: "1px solid rgba(248,113,113,0.35)",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

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
              background: "#ffffff",
              color: "#000",
              border: "1px solid #ffffff",
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
            All members can edit
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
            This room is shared with you. Its owner controls access and editing.
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