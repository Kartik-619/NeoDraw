import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "../../apps/http-backend/src/middleware";
import { createMemoryContainer, MemoryContainer } from "./helpers/memoryRepositories";

function buildApp(container: MemoryContainer) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get("/room/:slug", async (req, res) => {
    let room = await container.rooms.findBySlug(req.params.slug);
    if (!room) room = await container.rooms.create({ slug: req.params.slug, adminId: undefined });
    res.json({ room });
  });

  app.post("/rooms/:slug/chat", middleware, async (req: any, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Message required" });
    const room = await container.rooms.findBySlug(req.params.slug);
    if (!room) return res.status(404).json({ message: "Room not found" });
    const chat = await container.chats.create({ message, userId: req.userId, roomId: room.id });
    res.json({ success: true, chat });
  });

  app.get("/rooms/:slug/chats", async (req, res) => {
    const room = await container.rooms.findBySlug(req.params.slug);
    if (!room) return res.json({ messages: [] });
    const messages = await container.chats.findRecentByRoomId(room.id);
    res.json({ messages });
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
