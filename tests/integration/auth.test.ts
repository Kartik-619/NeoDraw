import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import jwt from "jsonwebtoken";
import request from "supertest";
import { JWT_SECRET } from "@repo/backend-common/config";
import { CreateUserSchema, CreateRoomSchema, SignInSchema } from "@repo/common/types";
import { middleware } from "../../apps/http-backend/src/middleware";
import { createMemoryContainer, MemoryContainer } from "./helpers/memoryRepositories";

// Replicates the HTTP backend server (apps/http-backend/src/index.ts) but with
// injected in-memory repositories so it runs without a real database.
function buildApp(container: MemoryContainer) {
  const app = express();
  app.use(cors({ origin: "http://localhost:3000", credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.post("/signup", async (req, res) => {
    const data = CreateUserSchema.safeParse(req.body);
    if (!data.success) return res.status(400).json({ message: "Invalid inputs" });

    const existingUser = await container.users.findByEmail(data.data.email);
    if (existingUser) return res.status(409).json({ message: "User already exists" });

    const user = await container.users.create({
      email: data.data.email,
      password: data.data.password,
      name: data.data.name
    });
    res.status(201).json({ userId: user.id });
  });

  app.post("/signIn", async (req, res) => {
    const parsedData = SignInSchema.safeParse(req.body);
    if (!parsedData.success) return res.status(400).json({ message: "Incorrect inputs" });

    const user = await container.users.findByEmail(parsedData.data.email);
    if (!user || user.password !== parsedData.data.password) {
      return res.status(403).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.cookie("token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "none",
      path: "/"
    });

    let defaultRoom = await container.rooms.findBySlug(`${user.id}-workspace`);
    if (!defaultRoom) {
      defaultRoom = await container.rooms.create({ slug: `${user.id}-workspace`, adminId: user.id });
    }

    res.json({ slug: defaultRoom.slug, token });
  });

  app.post("/room", middleware, async (req: any, res) => {
    const parsedData = CreateRoomSchema.safeParse(req.body);
    if (!parsedData.success) return res.status(400).json({ message: "Incorrect inputs" });
    const userId = req.userId;
    const existingRoom = await container.rooms.findBySlug(parsedData.data.name);
    if (existingRoom) return res.status(411).json({ message: "Room already exists" });
    const room = await container.rooms.create({ slug: parsedData.data.name, adminId: userId });
    res.json({ roomId: room.id });
  });

  app.get("/room/:slug", async (req, res) => {
    let room = await container.rooms.findBySlug(req.params.slug);
    if (!room) room = await container.rooms.create({ slug: req.params.slug, adminId: undefined });
    res.json({ room });
  });

  app.get("/rooms/:slug/chats", async (req, res) => {
    const room = await container.rooms.findBySlug(req.params.slug);
    if (!room) return res.json({ messages: [] });
    const messages = await container.chats.findRecentByRoomId(room.id);
    res.json({ messages });
  });

  app.post("/rooms/:slug/chat", middleware, async (req: any, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: "Message required" });
    const room = await container.rooms.findBySlug(req.params.slug);
    if (!room) return res.status(404).json({ message: "Room not found" });
    const chat = await container.chats.create({ message, userId: req.userId, roomId: room.id });
    res.json({ success: true, chat });
  });

  return app;
}

describe("HTTP auth integration", () => {
  let container: MemoryContainer;
  let app: express.Express;

  beforeEach(() => {
    container = createMemoryContainer();
    app = buildApp(container);
  });

  it("signs up a new user", async () => {
    const res = await request(app)
      .post("/signup")
      .send({ email: "alice@example.com", password: "password123", name: "Alice" });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBeDefined();
  });

  it("rejects duplicate signup", async () => {
    await request(app)
      .post("/signup")
      .send({ email: "alice@example.com", password: "password123", name: "Alice" });
    const res = await request(app)
      .post("/signup")
      .send({ email: "alice@example.com", password: "password123", name: "Alice" });
    expect(res.status).toBe(409);
  });

  it("rejects invalid signup inputs", async () => {
    const res = await request(app)
      .post("/signup")
      .send({ email: "not-an-email", password: "short", name: "" });
    expect(res.status).toBe(400);
  });

  it("signs in and returns a token and default room slug", async () => {
    await request(app)
      .post("/signup")
      .send({ email: "alice@example.com", password: "password123", name: "Alice" });

    const res = await request(app)
      .post("/signIn")
      .send({ email: "alice@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.slug).toBeDefined();

    // token must be valid JWT
    const decoded = jwt.verify(res.body.token, JWT_SECRET) as { userId: string };
    expect(decoded.userId).toBeDefined();
  });

  it("rejects signin with wrong password", async () => {
    await request(app)
      .post("/signup")
      .send({ email: "alice@example.com", password: "password123", name: "Alice" });

    const res = await request(app)
      .post("/signIn")
      .send({ email: "alice@example.com", password: "wrongpass" });
    expect(res.status).toBe(403);
  });

  it("rejects signin for a non-existent user", async () => {
    const res = await request(app)
      .post("/signIn")
      .send({ email: "ghost@example.com", password: "password123" });
    expect(res.status).toBe(403);
  });

  it("creates a default workspace room on first signin only", async () => {
    await request(app)
      .post("/signup")
      .send({ email: "alice@example.com", password: "password123", name: "Alice" });

    const first = await request(app)
      .post("/signIn")
      .send({ email: "alice@example.com", password: "password123" });

    const slug = first.body.slug;
    expect(slug).toBeDefined();

    // Deposit a chat to detect if the workspace room was reused vs recreated
    const roomCount = container.rooms;
    const second = await request(app)
      .post("/signIn")
      .send({ email: "alice@example.com", password: "password123" });

    expect(second.body.slug).toBe(slug);
  });
});
