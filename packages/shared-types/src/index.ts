export type Tool = "circle" | "rect" | "pencil" | "diamond" | "text" | "eraser" | "select";

export type Shape =
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      type: "circle";
      centerX: number;
      centerY: number;
      radius: number;
    }
  | {
      type: "pencil";
      startX: number;
      startY: number;
      endX: number;
      endY: number;
    }
  | {
      type: "diamond";
      centerX: number;
      centerY: number;
      width: number;
      height: number;
    }
  | {
      type: "text";
      x: number;
      y: number;
      text: string;
      fontSize: number;
      color?: string;
    };

// A shape that has been persisted on the server and therefore carries an id.
export type PersistedShape = Shape & { id: string; userId: string };

// WebSocket message types exchanged between the frontend and the WS backend
// for shape collaboration.
export type ServerShapeMessage =
  | { type: "shape_add"; roomId: string; shape: PersistedShape }
  | { type: "shape_update"; roomId: string; shape: PersistedShape }
  | { type: "shape_delete"; roomId: string; shapeId: string }
  | { type: "shape_delete_many"; roomId: string; shapeIds: string[] };

// Runtime guard used by both backends to validate shapes coming from clients.
export function isValidShape(shape: unknown): shape is Shape {
  if (!shape || typeof shape !== "object") return false;
  const s = shape as Record<string, unknown>;
  if (typeof s.type !== "string") return false;

  switch (s.type) {
    case "rect":
      return typeof s.x === "number" && typeof s.y === "number" &&
        typeof s.width === "number" && typeof s.height === "number";
    case "circle":
      return typeof s.centerX === "number" && typeof s.centerY === "number" &&
        typeof s.radius === "number";
    case "pencil":
      return typeof s.startX === "number" && typeof s.startY === "number" &&
        typeof s.endX === "number" && typeof s.endY === "number";
    case "diamond":
      return typeof s.centerX === "number" && typeof s.centerY === "number" &&
        typeof s.width === "number" && typeof s.height === "number";
    case "text":
      return typeof s.x === "number" && typeof s.y === "number" &&
        typeof s.text === "string" && typeof s.fontSize === "number";
    default:
      return false;
  }
}
