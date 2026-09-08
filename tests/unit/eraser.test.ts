import { describe, it, expect } from "vitest";
import type { PersistedShape } from "@repo/shared-types";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Mirrors the eraser logic in apps/neodraw-frontend/draw/Game.ts (durable,
// id-based erase): returns true when the shape intersects the eraser rect and
// must be deleted.
function intersects(shape: PersistedShape, eraserRect: Rect): boolean {
  const rectsOverlap = (a: Rect, b: Rect): boolean =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;

  switch (shape.type) {
    case "rect":
      return rectsOverlap(eraserRect, { x: shape.x, y: shape.y, width: shape.width, height: shape.height });
    case "circle": {
      const circleBox = {
        x: shape.centerX - shape.radius,
        y: shape.centerY - shape.radius,
        width: shape.radius * 2,
        height: shape.radius * 2
      };
      return rectsOverlap(eraserRect, circleBox);
    }
    case "diamond": {
      const diamondBox = {
        x: shape.centerX - shape.width / 2,
        y: shape.centerY - shape.height / 2,
        width: shape.width,
        height: shape.height
      };
      return rectsOverlap(eraserRect, diamondBox);
    }
    case "pencil": {
      const minX = Math.min(shape.startX, shape.endX);
      const maxX = Math.max(shape.startX, shape.endX);
      const minY = Math.min(shape.startY, shape.endY);
      const maxY = Math.max(shape.startY, shape.endY);
      return rectsOverlap(eraserRect, { x: minX, y: minY, width: maxX - minX, height: maxY - minY });
    }
    case "text": {
      const margin = 8;
      return (
        shape.x >= eraserRect.x - margin &&
        shape.x <= eraserRect.x + eraserRect.width + margin &&
        shape.y >= eraserRect.y - margin &&
        shape.y <= eraserRect.y + eraserRect.height + margin
      );
    }
    default:
      return false;
  }
}

function withId<T extends { type: string }>(s: T): PersistedShape {
  return { ...s, id: "id-" + s.type, userId: "u1" } as PersistedShape;
}

describe("Eraser intersection logic (durable id-based)", () => {
  it("erases a rectangle overlapping the eraser area", () => {
    const shape = withId({ type: "rect", x: 0, y: 0, width: 50, height: 50 });
    expect(intersects(shape, { x: 25, y: 25, width: 20, height: 20 })).toBe(true);
  });

  it("keeps a rectangle fully outside the eraser area", () => {
    const shape = withId({ type: "rect", x: 100, y: 100, width: 50, height: 50 });
    expect(intersects(shape, { x: 0, y: 0, width: 20, height: 20 })).toBe(false);
  });

  it("erases a circle whose bounding box intersects the eraser", () => {
    const shape = withId({ type: "circle", centerX: 10, centerY: 10, radius: 10 });
    expect(intersects(shape, { x: 5, y: 5, width: 20, height: 10 })).toBe(true);
  });

  it("keeps a distant circle", () => {
    const shape = withId({ type: "circle", centerX: 200, centerY: 200, radius: 5 });
    expect(intersects(shape, { x: 0, y: 0, width: 20, height: 20 })).toBe(false);
  });

  it("erases a pencil line that spans the eraser bounds", () => {
    const shape = withId({ type: "pencil", startX: 0, startY: 0, endX: 100, endY: 100 });
    expect(intersects(shape, { x: 40, y: 40, width: 20, height: 20 })).toBe(true);
  });

  it("erases a diamond overlapping the eraser", () => {
    const shape = withId({ type: "diamond", centerX: 10, centerY: 10, width: 20, height: 20 });
    expect(intersects(shape, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });

  it("keeps a diamond far from the eraser", () => {
    const shape = withId({ type: "diamond", centerX: 50, centerY: 50, width: 10, height: 10 });
    expect(intersects(shape, { x: 0, y: 0, width: 10, height: 10 })).toBe(false);
  });

  it("erases a text shape whose anchor falls inside/near the eraser", () => {
    const shape = withId({ type: "text", x: 40, y: 40, text: "Hi", fontSize: 16 });
    expect(intersects(shape, { x: 30, y: 30, width: 20, height: 20 })).toBe(true);
  });

  it("keeps a text shape far from the eraser", () => {
    const shape = withId({ type: "text", x: 300, y: 300, text: "Hi", fontSize: 16 });
    expect(intersects(shape, { x: 0, y: 0, width: 20, height: 20 })).toBe(false);
  });

  it("eraser never touches shapes in another region (multi-shape isolation)", () => {
    const hit = withId({ type: "rect", x: 10, y: 10, width: 5, height: 5 });
    const safe = withId({ type: "rect", x: 500, y: 500, width: 50, height: 50 });
    const eraserRect: Rect = { x: 0, y: 0, width: 30, height: 30 };

    const erasedIds = [hit, safe].filter((s) => intersects(s, eraserRect)).map((s) => s.id);
    expect(erasedIds).toEqual(["id-rect"]);
  });
});