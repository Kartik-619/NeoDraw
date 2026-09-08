import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "../../apps/http-backend/src/middleware";
import { isValidShape } from "@repo/shared-types";
import { createMemoryContainer, MemoryContainer } from "./helpers/memoryRepositories";

function buildApp(container: MemoryContainer) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/room/:slug", async (req: any, res: any) => {
    let room = await container.rooms.findBySlug(req.params.slug);
    if (!room) room = await container.rooms.create({ slug: req.params.slug, adminId: undefined });
    res.json({ room });
  });

  app.post("/rooms/:slug/chat", middleware, async (req: any, res: any) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Message required" });
    const room = await container.rooms.findBySlug(req.params.slug);
    if (!room) return res.status(404).json({ message: "Room not found" });
    const chat = await container.chats.create({ message, userId: req.userId, roomId: room.id });
    res.json({ success: true, chat });
  });

  app.get("/rooms/:slug/chats", async (req: any, res: any) => {
    const room = await container.rooms.findBySlug(req.params.slug);
    if (!room) return res.json({ messages: [] });
    const messages = await container.chats.findRecentByRoomId(room.id);
    res.json({ messages });
  });

  // ---- Shape CRUD (mirrors apps/http-backend/src/index.ts) ----
  app.get("/rooms/:slug/shapes", async (req: any, res: any) => {
    let room = await container.rooms.findBySlug(req.params.slug);
    if (!room) room = await container.rooms.create({ slug: req.params.slug, adminId: undefined });
    const stored = await container.shapes.findByRoomId(room.id);
    res.json({ shapes: stored.map((s) => ({ ...(s.data as object), id: s.id, userId: s.userId })) });
  });

  app.post("/rooms/:slug/shapes", middleware, async (req: any, res: any) => {
    const shape = req.body.shape;
    if (!isValidShape(shape)) return res.status(400).json({ message: "Invalid shape" });
    let room = await container.rooms.findBySlug(req.params.slug);
    if (!room) room = await container.rooms.create({ slug: req.params.slug, adminId: undefined });
    const persisted = await container.shapes.create({
      roomId: room.id,
      userId: req.userId,
      shape,
      id: typeof shape.id === "string" ? shape.id : undefined
    });
    res.status(201).json({ shape: persisted });
  });

  app.patch("/rooms/:slug/shapes/:shapeId", middleware, async (req: any, res: any) => {
    const { shape } = req.body;
    if (!isValidShape(shape)) return res.status(400).json({ message: "Invalid shape" });
    let room = await container.rooms.findBySlug(req.params.slug);
    if (!room) room = await container.rooms.create({ slug: req.params.slug, adminId: undefined });
    const existing = await container.shapes.findById(req.params.shapeId);
    if (!existing || existing.roomId !== room.id) return res.status(404).json({ message: "Shape not found" });
    const updated = await container.shapes.update(req.params.shapeId, shape);
    res.json({ shape: updated });
  });

  app.delete("/rooms/:slug/shapes/:shapeId", middleware, async (req: any, res: any) => {
    let room = await container.rooms.findBySlug(req.params.slug);
    if (!room) room = await container.rooms.create({ slug: req.params.slug, adminId: undefined });
    const existing = await container.shapes.findById(req.params.shapeId);
    if (!existing || existing.roomId !== room.id) return res.status(404).json({ message: "Shape not found" });
    await container.shapes.remove(req.params.shapeId);
    res.json({ success: true });
  });

  app.post("/rooms/:slug/shapes/delete-many", middleware, async (req: any, res: any) => {
    const { shapeIds } = req.body;
    if (!Array.isArray(shapeIds) || shapeIds.length === 0) return res.status(400).json({ message: "shapeIds required" });
    let room = await container.rooms.findBySlug(req.params.slug);
    if (!room) room = await container.rooms.create({ slug: req.params.slug, adminId: undefined });
    const removed = await container.shapes.removeMany(shapeIds.map(String));
    res.json({ success: true, removed });
  });

  return app;
}

function authToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET);
}

describe("Room and chat integration", () => {
  let container: MemoryContainer;
  let app: express.Express;

  beforeEach(() => {
    container = createMemoryContainer();
    app = buildApp(container);
  });

  it("creates a room on GET /room/:slug when missing", async () => {
    const res = await request(app).get("/room/design");
    expect(res.status).toBe(200);
    expect(res.body.room).toBeDefined();
    expect(res.body.room.slug).toBe("design");
  });

  it("returns the existing room on subsequent requests", async () => {
    await request(app).get("/room/design");
    const res = await request(app).get("/room/design");
    expect(res.body.room.slug).toBe("design");
  });

  it("rejects a chat post without a valid token", async () => {
    const res = await request(app)
      .post("/rooms/design/chat")
      .send({ message: "hello" });
    expect(res.status).toBe(403);
  });

  it("accepts a chat post with a valid token", async () => {
    await request(app).get("/room/design");
    const res = await request(app)
      .post("/rooms/design/chat")
      .set("Cookie", `token=${authToken("user-1")}`)
      .send({ message: "hello" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.chat.message).toBe("hello");
  });

  it("rejects a chat post when the room does not exist", async () => {
    const res = await request(app)
      .post("/rooms/missing-room/chat")
      .set("Cookie", `token=${authToken("user-1")}`)
      .send({ message: "hello" });
    expect(res.status).toBe(404);
  });

  it("persists chats and returns them via the chats endpoint", async () => {
    const cookie = `token=${authToken("user-1")}`;

    await request(app).get("/room/design");
    await request(app).post("/rooms/design/chat").set("Cookie", cookie).send({ message: "first" });
    await request(app).post("/rooms/design/chat").set("Cookie", cookie).send({ message: "second" });

    const res = await request(app).get("/rooms/design/chats");
    expect(res.status).toBe(200);
    const messages = (res.body.messages as { message: string }[]).sort((a, b) =>
      a.message.localeCompare(b.message)
    );
    expect(messages.map((m) => m.message)).toEqual(["first", "second"]);
  });

  it("returns an empty message list for a room without chats", async () => {
    await request(app).get("/room/empty");
    const res = await request(app).get("/rooms/empty/chats");
    expect(res.body.messages).toEqual([]);
  });
});

describe("Shape CRUD over HTTP", () => {
  let container: MemoryContainer;
  let app: express.Express;
  let cookie: string;

  beforeEach(() => {
    container = createMemoryContainer();
    app = buildApp(container);
    cookie = `token=${authToken("user-1")}`;
  });

  it("creates a shape and reads it back", async () => {
    const create = await request(app)
      .post("/rooms/design/shapes")
      .set("Cookie", cookie)
      .send({ shape: { type: "rect", id: "r1", x: 1, y: 2, width: 30, height: 20 } });

    expect(create.status).toBe(201);
    expect(create.body.shape.id).toBe("r1");

    const res = await request(app).get("/rooms/design/shapes");
    expect(res.status).toBe(200);
    expect(res.body.shapes).toHaveLength(1);
    expect(res.body.shapes[0]).toMatchObject({ type: "rect", x: 1, y: 2 });
  });

  it("rejects an invalid shape on create", async () => {
    const res = await request(app)
      .post("/rooms/design/shapes")
      .set("Cookie", cookie)
      .send({ shape: { type: "weird" } });
    expect(res.status).toBe(400);
  });

  it("creates and persists a text shape", async () => {
    const res = await request(app)
      .post("/rooms/design/shapes")
      .set("Cookie", cookie)
      .send({ shape: { type: "text", x: 10, y: 10, text: "Hello world", fontSize: 18 } });

    expect(res.status).toBe(201);
    expect(res.body.shape.type).toBe("text");

    const read = await request(app).get("/rooms/design/shapes");
    expect(read.body.shapes[0]!.text).toBe("Hello world");
  });

  it("updates an existing shape", async () => {
    await request(app)
      .post("/rooms/design/shapes")
      .set("Cookie", cookie)
      .send({ shape: { type: "circle", id: "c1", centerX: 0, centerY: 0, radius: 5 } });

    const res = await request(app)
      .patch("/rooms/design/shapes/c1")
      .set("Cookie", cookie)
      .send({ shape: { type: "circle", id: "c1", centerX: 50, centerY: 60, radius: 10 } });

    expect(res.status).toBe(200);
    expect(res.body.shape.centerX).toBe(50);
  });

  it("returns 404 when updating a shape from another room", async () => {
    await request(app)
      .post("/rooms/design/shapes")
      .set("Cookie", cookie)
      .send({ shape: { type: "rect", id: "r1", x: 0, y: 0, width: 1, height: 1 } });

    const res = await request(app)
      .patch("/rooms/other/shapes/r1")
      .set("Cookie", cookie)
      .send({ shape: { type: "rect", id: "r1", x: 5, y: 5, width: 1, height: 1 } });
    expect(res.status).toBe(404);
  });

  it("deletes a single shape durably", async () => {
    await request(app)
      .post("/rooms/design/shapes")
      .set("Cookie", cookie)
      .send({ shape: { type: "rect", id: "r1", x: 0, y: 0, width: 1, height: 1 } });

    const del = await request(app).delete("/rooms/design/shapes/r1").set("Cookie", cookie);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const read = await request(app).get("/rooms/design/shapes");
    expect(read.body.shapes).toHaveLength(0);
  });

  it("deletes many shapes (eraser) at once", async () => {
    await request(app)
      .post("/rooms/design/shapes")
      .set("Cookie", cookie)
      .send({ shape: { type: "rect", id: "a", x: 0, y: 0, width: 1, height: 1 } });
    await request(app)
      .post("/rooms/design/shapes")
      .set("Cookie", cookie)
      .send({ shape: { type: "rect", id: "b", x: 0, y: 0, width: 1, height: 1 } });

    const res = await request(app)
      .post("/rooms/design/shapes/delete-many")
      .set("Cookie", cookie)
      .send({ shapeIds: ["a", "b"] });

    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(2);

    const read = await request(app).get("/rooms/design/shapes");
    expect(read.body.shapes).toHaveLength(0);
  });

  it("returns shapes isolated per room", async () => {
    await request(app)
      .post("/rooms/room-a/shapes")
      .set("Cookie", cookie)
      .send({ shape: { type: "rect", id: "x", x: 0, y: 0, width: 1, height: 1 } });

    const resA = await request(app).get("/rooms/room-a/shapes");
    const resB = await request(app).get("/rooms/room-b/shapes");

    expect(resA.body.shapes).toHaveLength(1);
    expect(resB.body.shapes).toHaveLength(0);
  });
});
