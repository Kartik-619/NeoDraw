import { describe, it, expect } from "vitest";
import { isValidShape } from "@repo/shared-types";

describe("Shared shape type validation (@repo/shared-types)", () => {
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

  it("accepts a valid text shape", () => {
    expect(isValidShape({ type: "text", x: 10, y: 20, text: "Hello", fontSize: 16 })).toBe(true);
  });

  it("rejects a text shape without content", () => {
    expect(isValidShape({ type: "text", x: 10, y: 20, text: "", fontSize: 16 })).toBe(true);
    expect(isValidShape({ type: "text", x: 10, y: 20, fontSize: 16 })).toBe(false);
  });

  it("rejects shapes with an unknown type", () => {
    expect(isValidShape({ type: "triangle", x: 0, y: 0, width: 1, height: 1 })).toBe(false);
  });

  it("rejects the eraser rectangle (not a shape)", () => {
    expect(isValidShape({ type: "eraser", x: 0, y: 0, width: 5, height: 5 })).toBe(false);
  });

  it("accepts a persisted shape carrying an id and userId", () => {
    expect(isValidShape({ type: "rect", x: 0, y: 0, width: 1, height: 1, id: "abc", userId: "u1" })).toBe(true);
  });

  it("rejects null and undefined shapes", () => {
    expect(isValidShape(null)).toBe(false);
    expect(isValidShape(undefined)).toBe(false);
  });
});