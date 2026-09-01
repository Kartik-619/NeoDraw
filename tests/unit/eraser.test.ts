import { describe, it, expect } from "vitest";
import type { Shape } from "@repo/shared-types";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Mirrors the eraser logic in apps/neodraw-frontend/draw/Game.ts:
// the filter predicate returns true to KEEP a shape (not intersecting the eraser),
// and false to remove it (intersecting the eraser).
function keepShape(shape: Shape, eraserRect: Rect): boolean {
  switch (shape.type) {
    case "rect":
      return !(eraserRect.x < shape.x + shape.width &&
               eraserRect.x + eraserRect.width > shape.x &&
               eraserRect.y < shape.y + shape.height &&
               eraserRect.y + eraserRect.height > shape.y);
    case "circle": {
      const circleBox = {
        x: shape.centerX - shape.radius,
        y: shape.centerY - shape.radius,
        width: shape.radius * 2,
        height: shape.radius * 2
      };
      return !(eraserRect.x < circleBox.x + circleBox.width &&
               eraserRect.x + eraserRect.width > circleBox.x &&
               eraserRect.y < circleBox.y + circleBox.height &&
               eraserRect.y + eraserRect.height > circleBox.y);
    }
    case "diamond": {
      const diamondBox = {
        x: shape.centerX - shape.width / 2,
        y: shape.centerY - shape.height / 2,
        width: shape.width,
        height: shape.height
      };
      return !(eraserRect.x < diamondBox.x + diamondBox.width &&
               eraserRect.x + eraserRect.width > diamondBox.x &&
               eraserRect.y < diamondBox.y + diamondBox.height &&
               eraserRect.y + eraserRect.height > diamondBox.y);
    }
    case "pencil": {
      const minX = Math.min(shape.startX, shape.endX);
      const maxX = Math.max(shape.startX, shape.endX);
      const minY = Math.min(shape.startY, shape.endY);
      const maxY = Math.max(shape.startY, shape.endY);
      return !(eraserRect.x < maxX &&
               eraserRect.x + eraserRect.width > minX &&
               eraserRect.y < maxY &&
               eraserRect.y + eraserRect.height > minY);
    }
    default:
      return true;
  }
}

// returns true if the shape was erased (removed)
function shouldErase(shape: Shape, eraserRect: Rect): boolean {
  return !keepShape(shape, eraserRect);
}

describe("Eraser intersection logic", () => {
  it("erases a rectangle overlapping the eraser area", () => {
    const shape: Shape = { type: "rect", x: 0, y: 0, width: 50, height: 50 };
    const eraserRect: Rect = { x: 25, y: 25, width: 20, height: 20 };
    expect(shouldErase(shape, eraserRect)).toBe(true);
  });

  it("keeps a rectangle fully outside the eraser area", () => {
    const shape: Shape = { type: "rect", x: 100, y: 100, width: 50, height: 50 };
    const eraserRect: Rect = { x: 0, y: 0, width: 20, height: 20 };
    expect(shouldErase(shape, eraserRect)).toBe(false);
  });

  it("erases a circle whose bounding box intersects the eraser", () => {
    const shape: Shape = { type: "circle", centerX: 10, centerY: 10, radius: 10 };
    const eraserRect: Rect = { x: 5, y: 5, width: 20, height: 10 };
    expect(shouldErase(shape, eraserRect)).toBe(true);
  });

  it("keeps a distant circle", () => {
    const shape: Shape = { type: "circle", centerX: 200, centerY: 200, radius: 5 };
    const eraserRect: Rect = { x: 0, y: 0, width: 20, height: 20 };
    expect(shouldErase(shape, eraserRect)).toBe(false);
  });

  it("erases a pencil line that spans the eraser bounds", () => {
    const shape: Shape = { type: "pencil", startX: 0, startY: 0, endX: 100, endY: 100 };
    const eraserRect: Rect = { x: 40, y: 40, width: 20, height: 20 };
    expect(shouldErase(shape, eraserRect)).toBe(true);
  });

  it("erases a diamond overlapping the eraser", () => {
    const shape: Shape = { type: "diamond", centerX: 10, centerY: 10, width: 20, height: 20 };
    const eraserRect: Rect = { x: 5, y: 5, width: 10, height: 10 };
    expect(shouldErase(shape, eraserRect)).toBe(true);
  });

  it("keeps a diamond far from the eraser", () => {
    const shape: Shape = { type: "diamond", centerX: 50, centerY: 50, width: 10, height: 10 };
    const eraserRect: Rect = { x: 0, y: 0, width: 10, height: 10 };
    expect(shouldErase(shape, eraserRect)).toBe(false);
  });
});
