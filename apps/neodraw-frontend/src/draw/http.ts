import type { EditPermission, PersistedShape, RoomInfo } from "@repo/shared-types";
import { HTTP_BACKEND } from "@/lib/config";

export async function getExistingShapes(roomSlug: string): Promise<PersistedShape[]> {
  try {
    const res = await fetch(`${HTTP_BACKEND}/rooms/${roomSlug}/shapes`);
    if (!res.ok) return [];
    const data = await res.json() as { shapes: PersistedShape[] };
    return data.shapes;
  } catch {
    return [];
  }
}

export async function getRoom(roomSlug: string): Promise<RoomInfo | null> {
  try {
    const res = await fetch(`${HTTP_BACKEND}/room/${roomSlug}`, { cache: "no-store" });
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
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ editPermission }),
    });
    return res.ok;
  } catch {
    return false;
  }
}