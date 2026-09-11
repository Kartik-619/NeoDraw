export type Tool = "circle" | "rect" | "pencil" | "diamond" | "text" | "eraser" | "select";

export type EditPermission = "anyone" | "admin";

export type RoomInfo = { id: number; slug: string; adminId: string | null; editPermission: EditPermission };

export function canEditRoom(editPermission: EditPermission, adminId: string | null, userId: string): boolean {
  return editPermission === "anyone" || adminId === userId;
}

export type Shape =
  | { type: "rect"; x: number; y: number; width: number; height: number; color?: string }
  | { type: "circle"; centerX: number; centerY: number; radius: number; color?: string }
  | { type: "pencil"; startX: number; startY: number; endX: number; endY: number; color?: string }
  | { type: "diamond"; centerX: number; centerY: number; width: number; height: number; color?: string }
  | { type: "text"; x: number; y: number; text: string; fontSize: number; color?: string };

export type PersistedShape = Shape & { id: string; userId: string };

// --- WebSocket messages (client → server) ---

export type ClientMessage =
  | { type: "join_room"; roomId: string }
  | { type: "leave_room"; roomId: string }
  | { type: "chat"; roomId: string; message: string }
  | { type: "shape_add"; roomId: string; shape: PersistedShape }
  | { type: "shape_update"; roomId: string; shapeId: string; shape: Partial<Shape> }
  | { type: "shape_delete"; roomId: string; shapeId: string }
  | { type: "shape_delete_many"; roomId: string; shapeIds: string[] };

// --- WebSocket messages (server → client) ---

export type ServerShapeMessage =
  | { type: "connection"; userId: string }
  | { type: "joined_room"; roomId: string; room: RoomInfo; members: string[]; shapes: PersistedShape[] }
  | { type: "user_joined"; userId: string; roomId: string; members: string[] }
  | { type: "user_left"; userId: string; roomId: string; members: string[] }
  | { type: "chat"; message: string; roomId: string; userId: string; createdAt: string }
  | { type: "shape_add"; roomId: string; shape: PersistedShape }
  | { type: "shape_update"; roomId: string; shape: PersistedShape }
  | { type: "shape_delete"; roomId: string; shapeId: string }
  | { type: "shape_delete_many"; roomId: string; shapeIds: string[] };

// --- Shape validation ---

function isObject(v: unknown): v is { [key: string]: unknown } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function isValidShape(v: unknown): v is Shape {
  if (!isObject(v)) return false;

  switch (v["type"]) {
    case "rect":
      return isNumber(v["x"]) && isNumber(v["y"]) && isNumber(v["width"]) && isNumber(v["height"]);
    case "circle":
      return isNumber(v["centerX"]) && isNumber(v["centerY"]) && isNumber(v["radius"]);
    case "pencil":
      return isNumber(v["startX"]) && isNumber(v["startY"]) && isNumber(v["endX"]) && isNumber(v["endY"]);
    case "diamond":
      return isNumber(v["centerX"]) && isNumber(v["centerY"]) && isNumber(v["width"]) && isNumber(v["height"]);
    case "text":
      return isNumber(v["x"]) && isNumber(v["y"]) && typeof v["text"] === "string" && isNumber(v["fontSize"]);
    default:
      return false;
  }
}

export function isValidPersistedShape(v: unknown): v is PersistedShape {
  if (!isObject(v)) return false;
  if (typeof v["id"] !== "string" || typeof v["userId"] !== "string") return false;
  return isValidShape(v);
}

export function newId(): string {
  return crypto.randomUUID();
}
