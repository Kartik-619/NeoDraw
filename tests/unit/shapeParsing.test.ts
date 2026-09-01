import { describe, it, expect } from "vitest";
import type { Shape, Tool } from "@repo/shared-types";

const VALID_TOOLS: Tool[] = ["rect", "circle", "pencil", "diamond", "eraser"];

// Mirrors the shape-extraction logic in apps/neodraw-frontend/draw/http.ts
function extractShapesFromMessages(messages: { message: string }[]): Shape[] {
  const shapes: Shape[] = [];
  for (const x of messages) {
    try {
      const messageData = JSON.parse(x.message);
      if (messageData && messageData.shape && messageData.shape.type) {
        const t = messageData.shape.type as Tool;
        if (VALID_TOOLS.includes(t)) {
          shapes.push(messageData.shape as Shape);
        }
      }
    } catch {
      // skip non-shape chat messages
    }
  }
  return shapes;
}

describe("Shape extraction from chat messages", () => {
  it("returns an empty array for no messages", () => {
    expect(extractShapesFromMessages([])).toEqual([]);
  });

  it("extracts a single rectangle shape message", () => {
    const messages = [
      { message: JSON.stringify({ shape: { type: "rect", x: 0, y: 0, width: 10, height: 10 } }) }
    ];
    expect(extractShapesFromMessages(messages)).toEqual([
      { type: "rect", x: 0, y: 0, width: 10, height: 10 }
    ]);
  });

  it("extracts multiple shapes in order", () => {
    const messages = [
      { message: JSON.stringify({ shape: { type: "circle", centerX: 1, centerY: 2, radius: 3 } }) },
      { message: JSON.stringify({ shape: { type: "pencil", startX: 0, startY: 0, endX: 5, endY: 5 } }) }
    ];
    const shapes = extractShapesFromMessages(messages);
    expect(shapes).toHaveLength(2);
    expect(shapes[0]?.type).toBe("circle");
    expect(shapes[1]?.type).toBe("pencil");
  });

  it("ignores chat messages that are not shapes", () => {
    const messages = [
      { message: "just a plain chat text" },
      { message: JSON.stringify({ greeting: "hello" }) },
      { message: JSON.stringify({ shape: { type: "rect", x: 1, y: 1, width: 5, height: 5 } }) }
    ];
    const shapes = extractShapesFromMessages(messages);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.type).toBe("rect");
  });

  it("ignores messages containing malformed JSON", () => {
    const messages = [
      { message: "{ not valid json" },
      { message: JSON.stringify({ shape: { type: "diamond", centerX: 0, centerY: 0, width: 4, height: 4 } }) }
    ];
    const shapes = extractShapesFromMessages(messages);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.type).toBe("diamond");
  });

  it("ignores shapes with unknown types", () => {
    const messages = [
      { message: JSON.stringify({ shape: { type: "triangle", x: 0, y: 0, width: 1, height: 1 } }) },
      { message: JSON.stringify({ shape: { type: "circle", centerX: 0, centerY: 0, radius: 1 } }) }
    ];
    const shapes = extractShapesFromMessages(messages);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.type).toBe("circle");
  });
});
