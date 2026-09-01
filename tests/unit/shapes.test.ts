import { describe, it, expect } from "vitest";
import type { Shape, Tool } from "@repo/shared-types";

const TOOLS: Tool[] = ["circle", "rect", "pencil", "diamond", "eraser"];

function isValidShape(shape: unknown): shape is Shape {
  if (!shape || typeof shape !== "object") return false;
  const s = shape as Record<string, unknown>;
  if (typeof s.type !== "string") return false;
  if (!TOOLS.includes(s.type as Tool)) return false;
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
    case "eraser":
      return typeof s.x === "number" && typeof s.y === "number" &&
        typeof s.width === "number" && typeof s.height === "number";
    default:
      return false;
  }
}

describe("Shared shape type validation", () => {
  it("accepts a valid rectangle", () => {
    expect(isValidShape({ type: "rect", x: 0, y: 0, width: 10, height: 10 })).toBe(true);
  });

  it("rejects a rectangle missing a coordinate field", () => {
    expect(isValidShape({ type: "rect", x: 0, y: 0, width: 10 })).toBe(false);
  });

  it("accepts a valid circle", () => {
    expect(isValidShape({ type: "circle", centerX: 5, centerY: 5, radius: 3 })).toBe(true);
  });

  it("accepts a valid pencil line", () => {
    expect(isValidShape({ type: "pencil", startX: 1, startY: 2, endX: 3, endY: 4 })).toBe(true);
  });

  it("accepts a valid diamond", () => {
    expect(isValidShape({ type: "diamond", centerX: 1, centerY: 2, width: 4, height: 4 })).toBe(true);
  });

  it("accepts a valid eraser rectangle", () => {
    expect(isValidShape({ type: "eraser", x: 0, y: 0, width: 5, height: 5 })).toBe(true);
  });

  it("rejects shapes with an unknown type", () => {
    expect(isValidShape({ type: "triangle", x: 0, y: 0, width: 1, height: 1 })).toBe(false);
  });

  it("rejects null and undefined shapes", () => {
    expect(isValidShape(null)).toBe(false);
    expect(isValidShape(undefined)).toBe(false);
  });
});
