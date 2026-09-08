import { describe, it, expect } from "vitest";
import { newId } from "@repo/shared-types";

describe("newId", () => {
  it("returns a string", () => {
    expect(typeof newId()).toBe("string");
  });

  it("returns unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()));
    expect(ids.size).toBe(100);
  });
});
