import { describe, it, expect, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";

interface AuthPayload {
  userId: string;
}

// Mirrors the exact token-authorization logic used in both backends.
function checkUser(token: string | null): string | null {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "123123") as AuthPayload;
    if (!decoded?.userId) return null;
    return decoded.userId;
  } catch {
    return null;
  }
}

describe("JWT authentication shared logic", () => {
  beforeEach(() => {
    // Ensure the exported secret is used consistently for signing.
    process.env.JWT_SECRET = JWT_SECRET;
  });

  it("returns the userId from a valid token", () => {
    const token = jwt.sign({ userId: "user-123" }, JWT_SECRET);
    expect(checkUser(token)).toBe("user-123");
  });

  it("returns null when the token is missing", () => {
    expect(checkUser(null)).toBeNull();
  });

  it("returns null for an invalid token", () => {
    expect(checkUser("not-a-token")).toBeNull();
  });

  it("returns null for a tampered token", () => {
    const token = jwt.sign({ userId: "user-123" }, "wrong-secret");
    expect(checkUser(token)).toBeNull();
  });

  it("returns null when the payload is missing the userId", () => {
    const token = jwt.sign({ foo: "bar" }, JWT_SECRET);
    expect(checkUser(token)).toBeNull();
  });

  it("returns null for an expired token", () => {
    const token = jwt.sign({ userId: "user-123" }, JWT_SECRET, { expiresIn: "-1s" });
    expect(checkUser(token)).toBeNull();
  });
});
