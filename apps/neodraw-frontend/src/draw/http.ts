import type { EditPermission, PersistedShape, RoomInfo } from "@repo/shared-types";
import { HTTP_BACKEND } from "@/lib/config";

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface RoomMemberView {
  userId: string;
  email: string;
}

export async function getExistingShapes(roomSlug: string): Promise<PersistedShape[]> {
  try {
    const res = await fetch(`${HTTP_BACKEND}/rooms/${roomSlug}/shapes`, { headers: authHeaders() });
    if (!res.ok) return [];
    const data = await res.json() as { shapes: PersistedShape[] };
    return data.shapes;
  } catch {
    return [];
  }
}

export async function getRoom(roomSlug: string): Promise<RoomInfo | null> {
  try {
    const res = await fetch(`${HTTP_BACKEND}/room/${roomSlug}`, { cache: "no-store", headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json() as RoomInfo & { roomId: number };
    return { id: data.roomId, slug: data.slug, adminId: data.adminId, editPermission: data.editPermission };
  } catch {
    return null;
  }
}

export async function updateRoomPermission(roomSlug: string, editPermission: EditPermission): Promise<boolean> {
  try {
    const res = await fetch(`${HTTP_BACKEND}/rooms/${roomSlug}/permissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ editPermission }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listRoomMembers(roomSlug: string): Promise<RoomMemberView[]> {
  try {
    const res = await fetch(`${HTTP_BACKEND}/rooms/${roomSlug}/members`, { headers: authHeaders() });
    if (!res.ok) return [];
    const data = await res.json() as { members: RoomMemberView[] };
    return data.members;
  } catch {
    return [];
  }
}

export async function addRoomMember(roomSlug: string, email: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${HTTP_BACKEND}/rooms/${roomSlug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ email }),
    });
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: res.ok, message: data?.message };
  } catch {
    return { ok: false, message: "Network error" };
  }
}

export async function removeRoomMember(roomSlug: string, userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${HTTP_BACKEND}/rooms/${roomSlug}/members/${userId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}