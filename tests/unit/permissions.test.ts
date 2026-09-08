import { describe, it, expect, beforeEach } from "vitest";
import { canEditRoom } from "@repo/shared-types";
import { setupTestContainer } from "../helpers/memoryRepositories";
import type { Container } from "@repo/http-backend/src/application/container";

let container: Container;

beforeEach(() => {
  container = setupTestContainer();
});

describe("canEditRoom", () => {
  it("allows anyone when editPermission is anyone", () => {
    expect(canEditRoom("anyone", "admin-1", "user-2")).toBe(true);
    expect(canEditRoom("anyone", null, "user-2")).toBe(true);
  });

  it("restricts to the admin when editPermission is admin", () => {
    expect(canEditRoom("admin", "admin-1", "admin-1")).toBe(true);
    expect(canEditRoom("admin", "admin-1", "user-2")).toBe(false);
    expect(canEditRoom("admin", null, "user-2")).toBe(false);
  });
});

describe("Room edit permissions (via repository)", () => {
  it("defaults new rooms to anyone can edit", async () => {
    const room = await container.rooms.create({ slug: "default-room" });
    expect(room.editPermission).toBe("anyone");
  });

  it("updates editPermission", async () => {
    await container.rooms.create({ slug: "perm-room", adminId: "admin-1" });
    const updated = await container.rooms.updateEditPermission("perm-room", "admin");
    expect(updated).not.toBeNull();
    expect(updated!.editPermission).toBe("admin");
  });

  it("returns null when updating an unknown room", async () => {
    const updated = await container.rooms.updateEditPermission("missing-room", "admin");
    expect(updated).toBeNull();
  });
});