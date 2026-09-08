import { describe, it, expect } from "vitest";
import { CreateUserSchema, SignInSchema } from "@repo/common";

describe("CreateUserSchema", () => {
  it("accepts valid input", () => {
    const result = CreateUserSchema.safeParse({ email: "test@example.com", password: "12345678", name: "Test" });
    expect(result.success).toBe(true);
  });

  it("rejects short password", () => {
    const result = CreateUserSchema.safeParse({ email: "test@example.com", password: "123", name: "Test" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = CreateUserSchema.safeParse({ email: "not-email", password: "12345678", name: "Test" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = CreateUserSchema.safeParse({ email: "test@example.com", password: "12345678", name: "" });
    expect(result.success).toBe(false);
  });
});

describe("SignInSchema", () => {
  it("accepts valid input", () => {
    const result = SignInSchema.safeParse({ email: "test@example.com", password: "12345678" });
    expect(result.success).toBe(true);
  });

  it("rejects short password", () => {
    const result = SignInSchema.safeParse({ email: "test@example.com", password: "123" });
    expect(result.success).toBe(false);
  });
});
