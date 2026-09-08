import { describe, it, expect } from "vitest";
import { isValidShape, isValidPersistedShape } from "@repo/shared-types";

describe("isValidShape", () => {
  it("accepts valid rect", () => {
    expect(isValidShape({ type: "rect", x: 0, y: 0, width: 100, height: 50 })).toBe(true);
  });

  it("accepts valid circle", () => {
    expect(isValidShape({ type: "circle", centerX: 50, centerY: 50, radius: 25 })).toBe(true);
  });

  it("accepts valid pencil", () => {
    expect(isValidShape({ type: "pencil", startX: 0, startY: 0, endX: 100, endY: 100 })).toBe(true);
  });

  it("accepts valid diamond", () => {
    expect(isValidShape({ type: "diamond", centerX: 50, centerY: 50, width: 80, height: 60 })).toBe(true);
  });

  it("accepts valid text", () => {
    expect(isValidShape({ type: "text", x: 10, y: 20, text: "hello", fontSize: 16 })).toBe(true);
  });

  it("rejects missing field", () => {
    expect(isValidShape({ type: "rect", x: 0, y: 0, width: 100 })).toBe(false);
  });

  it("rejects wrong type", () => {
    expect(isValidShape({ type: "triangle", x: 0, y: 0 })).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isValidShape(null)).toBe(false);
    expect(isValidShape("string")).toBe(false);
  });
});

describe("isValidPersistedShape", () => {
  it("accepts valid persisted shape", () => {
    expect(isValidPersistedShape({ id: "abc", userId: "u1", type: "rect", x: 0, y: 0, width: 10, height: 10 })).toBe(true);
  });

  it("rejects missing id", () => {
    expect(isValidPersistedShape({ userId: "u1", type: "rect", x: 0, y: 0, width: 10, height: 10 })).toBe(false);
  });

  it("rejects missing userId", () => {
    expect(isValidPersistedShape({ id: "abc", type: "rect", x: 0, y: 0, width: 10, height: 10 })).toBe(false);
  });
});
