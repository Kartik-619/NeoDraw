import { describe, it, expect } from "vitest";
import {
  CreateUserSchema,
  SignInSchema,
  CreateRoomSchema
} from "@repo/common/types";

describe("CreateUserSchema", () => {
  it("accepts a valid user payload", () => {
    const result = CreateUserSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      name: "Alice"
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = CreateUserSchema.safeParse({
      email: "not-an-email",
      password: "password123",
      name: "Alice"
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = CreateUserSchema.safeParse({
      email: "user@example.com",
      password: "short",
      name: "Alice"
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = CreateUserSchema.safeParse({
      email: "user@example.com",
      password: "password123"
    });
    expect(result.success).toBe(false);
  });
});

describe("SignInSchema", () => {
  it("accepts a valid signin payload", () => {
    const result = SignInSchema.safeParse({
      email: "user@example.com",
      password: "password123"
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = SignInSchema.safeParse({
      email: "invalid",
      password: "password123"
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const result = SignInSchema.safeParse({
      email: "user@example.com"
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateRoomSchema", () => {
  it("accepts a valid room name", () => {
    const result = CreateRoomSchema.safeParse({ name: "design-room" });
    expect(result.success).toBe(true);
  });

  it("rejects a room name shorter than 3 characters", () => {
    const result = CreateRoomSchema.safeParse({ name: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects a room name longer than 20 characters", () => {
    const result = CreateRoomSchema.safeParse({ name: "a".repeat(21) });
    expect(result.success).toBe(false);
  });
});
