import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { setupTestContainer } from "../helpers/memoryRepositories";
import type { Container } from "@repo/http-backend/src/application/container";

let container: Container;

beforeEach(() => {
  container = setupTestContainer();
});

describe("Shape CRUD (via repository)", () => {
  it("creates and retrieves shapes", async () => {
    const room = await container.rooms.create({ slug: "test-room" });
    const user = await container.users.create({ email: "a@b.com", password: "12345678", name: "A" });

    const shape = await container.shapes.create({
      roomId: room.id,
      userId: user.id,
      shape: { id: "s1", userId: user.id, type: "rect", x: 10, y: 20, width: 100, height: 50 },
    });

    expect(shape.id).toBe("s1");

    const all = await container.shapes.findByRoomId(room.id);
    expect(all).toHaveLength(1);
    expect(all[0]!.type).toBe("rect");
  });

  it("updates a shape", async () => {
    const room = await container.rooms.create({ slug: "test-room-2" });
    const user = await container.users.create({ email: "b@b.com", password: "12345678", name: "B" });

    await container.shapes.create({
      roomId: room.id,
      userId: user.id,
      shape: { id: "s2", userId: user.id, type: "rect", x: 0, y: 0, width: 50, height: 50 },
    });

    const updated = await container.shapes.update(room.id, "s2", { type: "circle", centerX: 25, centerY: 25, radius: 20 });
    expect(updated).not.toBeNull();
    expect(updated!.type).toBe("circle");
  });

  it("deletes a shape", async () => {
    const room = await container.rooms.create({ slug: "test-room-3" });
    const user = await container.users.create({ email: "c@b.com", password: "12345678", name: "C" });

    await container.shapes.create({
      roomId: room.id,
      userId: user.id,
      shape: { id: "s3", userId: user.id, type: "rect", x: 0, y: 0, width: 50, height: 50 },
    });

    const deleted = await container.shapes.delete(room.id, "s3");
    expect(deleted).toBe(true);

    const all = await container.shapes.findByRoomId(room.id);
    expect(all).toHaveLength(0);
  });

  it("bulk deletes shapes", async () => {
    const room = await container.rooms.create({ slug: "test-room-4" });
    const user = await container.users.create({ email: "d@b.com", password: "12345678", name: "D" });

    await container.shapes.create({
      roomId: room.id,
      userId: user.id,
      shape: { id: "s4a", userId: user.id, type: "rect", x: 0, y: 0, width: 10, height: 10 },
    });
    await container.shapes.create({
      roomId: room.id,
      userId: user.id,
      shape: { id: "s4b", userId: user.id, type: "circle", centerX: 50, centerY: 50, radius: 5 },
    });

    const removed = await container.shapes.deleteMany(room.id, ["s4a", "s4b"]);
    expect(removed).toHaveLength(2);

    const all = await container.shapes.findByRoomId(room.id);
    expect(all).toHaveLength(0);
  });
});

describe("Room creation", () => {
  it("creates and finds rooms by slug", async () => {
    const room = await container.rooms.create({ slug: "my-room" });
    const found = await container.rooms.findBySlug("my-room");
    expect(found).not.toBeNull();
    expect(found!.slug).toBe("my-room");
  });

  it("returns null for non-existent slug", async () => {
    const found = await container.rooms.findBySlug("nope");
    expect(found).toBeNull();
  });
});

describe("User creation", () => {
  it("creates and finds users by email", async () => {
    const { id } = await container.users.create({ email: "test@test.com", password: "hashed", name: "Test" });
    const user = await container.users.findByEmail("test@test.com");
    expect(user).not.toBeNull();
    expect(user!.id).toBe(id);
  });

  it("returns null for non-existent email", async () => {
    const user = await container.users.findByEmail("nope@test.com");
    expect(user).toBeNull();
  });
});
