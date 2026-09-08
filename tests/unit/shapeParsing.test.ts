import { describe, it, expect } from "vitest";
import { isValidShape, PersistedShape } from "@repo/shared-types";

// Mirrors the shape-filtering logic in apps/neodraw-frontend/draw/http.ts
// which loads persisted shapes from GET /rooms/:slug/shapes.
function extractShapes(payload: { shapes: unknown }): PersistedShape[] {
  const shapes = payload.shapes;
  if (!Array.isArray(shapes)) return [];
  return (shapes as PersistedShape[]).filter(
    (s) => s && typeof s === "object" && typeof (s as { id?: unknown }).id === "string" && isValidShape(s)
  );
}

describe("Shape extraction from /rooms/:slug/shapes payloads", () => {
  it("returns an empty array for no shapes", () => {
    expect(extractShapes({ shapes: [] })).toEqual([]);
  });

  it("returns an empty array for a malformed payload", () => {
    expect(extractShapes({ shapes: "not-an-array" })).toEqual([]);
  });

  it("extracts a single persisted rectangle", () => {
    const shapes = extractShapes({
      shapes: [{ type: "rect", id: "r1", userId: "u1", x: 0, y: 0, width: 10, height: 10 }]
    });
    expect(shapes).toHaveLength(1);
    expect(shapes[0]!.id).toBe("r1");
  });

  it("extracts multiple shapes and keeps order", () => {
    const shapes = extractShapes({
      shapes: [
        { type: "circle", id: "c1", userId: "u1", centerX: 1, centerY: 2, radius: 3 },
        { type: "text", id: "t1", userId: "u2", x: 0, y: 0, text: "hey", fontSize: 16 }
      ]
    });
    expect(shapes).toHaveLength(2);
    expect(shapes[0]!.type).toBe("circle");
    expect(shapes[1]!.type).toBe("text");
  });

  it("ignores persisted shapes missing an id", () => {
    const shapes = extractShapes({
      shapes: [{ type: "rect", x: 1, y: 1, width: 5, height: 5 }]
    });
    expect(shapes).toHaveLength(0);
  });

  it("ignores shapes with unknown types", () => {
    const shapes = extractShapes({
      shapes: [
        { type: "triangle", id: "bad", x: 0, y: 0 },
        { type: "circle", id: "c1", userId: "u1", centerX: 0, centerY: 0, radius: 1 }
      ]
    });
    expect(shapes).toHaveLength(1);
    expect(shapes[0]!.type).toBe("circle");
  });

  it("ignores non-object entries", () => {
    const shapes = extractShapes({ shapes: [null, "junk", 42] });
    expect(shapes).toEqual([]);
  });
});