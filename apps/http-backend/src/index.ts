import "@repo/backend-common/env";
import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { CreateUserSchema, SignInSchema, CreateRoomSchema } from "@repo/common";
import { JWT_SECRET } from "@repo/backend-common";
import { isValidShape, isValidPersistedShape, newId, canEditRoom, type EditPermission } from "@repo/shared-types";
import { getContainer } from "./application/container";
import type { RoomRecord } from "./application/repositories";
import { authMiddleware, type AuthRequest } from "./middleware";

async function main() {
  const container = await getContainer();
  const app = express();

  function getParam(value: string | string[] | undefined): string | null {
    return typeof value === "string" ? value : null;
  }

  app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }));
  app.use(express.json());
  app.use(cookieParser());

  // --- Auth ---

  app.post("/signup", async (req: Request, res: Response) => {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten().fieldErrors });
      return;
    }
    const { email, password, name } = parsed.data;
    const existing = await container.users.findByEmail(email);
    if (existing) {
      res.status(409).json({ message: "Email already in use" });
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    const { id } = await container.users.create({ email, password: hashed, name });
    res.status(201).json({ userId: id });
  });

  app.post("/signIn", async (req: Request, res: Response) => {
    const parsed = SignInSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input" });
      return;
    }
    const { email, password } = parsed.data;
    const user = await container.users.findByEmail(email);
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.cookie("token", token, { httpOnly: true, sameSite: "lax" });

    // Ensure default workspace room exists
    const slug = `${user.id}-workspace`;
    const existing = await container.rooms.findBySlug(slug);
    if (!existing) {
      await container.rooms.create({ slug, adminId: user.id });
    }

    res.json({ slug, token, name: user.name });
  });

  // --- Current user ---

  app.get("/user/me", authMiddleware, async (req: AuthRequest, res: Response) => {
    const user = await container.users.findById(req.userId!);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({ id: user.id, name: user.name, email: user.email });
  });

  // --- Room ---

  app.post("/room", authMiddleware, async (req: AuthRequest, res: Response) => {
    const parsed = CreateRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid input" });
      return;
    }
    const slug = `room-${newId().slice(0, 8)}`;
    const room = await container.rooms.create({ slug, adminId: req.userId });
    res.status(201).json({ roomId: room.id, slug: room.slug });
  });

  // List rooms where the current user is admin
  app.get("/rooms", authMiddleware, async (req: AuthRequest, res: Response) => {
    const rooms = await container.rooms.findByAdminId(req.userId!);
    res.json({ rooms });
  });

  // Resolve room by slug (creates if missing)
  async function resolveRoomBySlug(slug: string): Promise<RoomRecord> {
    const existing = await container.rooms.findBySlug(slug);
    if (existing) return existing;
    return await container.rooms.create({ slug });
  }

  function canEdit(room: RoomRecord, userId: string): boolean {
    return canEditRoom(room.editPermission, room.adminId ?? null, userId);
  }

  app.get("/room/:slug", async (req: Request, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoomBySlug(slug);
    res.json({ roomId: room.id, slug: room.slug, adminId: room.adminId, editPermission: room.editPermission });
  });

  // Update room sharing permission (admin only)
  app.patch("/rooms/:slug/permissions", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoomBySlug(slug);
    if (room.adminId !== req.userId) {
      res.status(403).json({ message: "Only the room owner can change sharing permissions" });
      return;
    }
    const { editPermission } = req.body as { editPermission?: unknown };
    if (editPermission !== "anyone" && editPermission !== "admin") {
      res.status(400).json({ message: "editPermission must be 'anyone' or 'admin'" });
      return;
    }
    const updated = await container.rooms.updateEditPermission(slug, editPermission as EditPermission);
    res.json({ slug, editPermission: updated?.editPermission ?? (editPermission as EditPermission) });
  });

  // --- Shape CRUD ---

  app.get("/rooms/:slug/shapes", async (req: Request, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoomBySlug(slug);
    const shapes = await container.shapes.findByRoomId(room.id);
    res.json({ shapes });
  });

  app.post("/rooms/:slug/shapes", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoomBySlug(slug);
    if (!canEdit(room, req.userId!)) {
      res.status(403).json({ message: "This room is view-only" });
      return;
    }
    const { shape } = req.body;
    if (!isValidPersistedShape(shape)) {
      res.status(400).json({ message: "Invalid shape" });
      return;
    }
    const persisted = await container.shapes.create({ roomId: room.id, userId: req.userId!, shape });
    res.status(201).json({ shape: persisted });
  });

  app.patch("/rooms/:slug/shapes/:shapeId", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    const shapeId = getParam(req.params.shapeId);
    if (!slug || !shapeId) {
      res.status(400).json({ message: "Invalid slug or shapeId" });
      return;
    }
    const room = await resolveRoomBySlug(slug);
    if (!canEdit(room, req.userId!)) {
      res.status(403).json({ message: "This room is view-only" });
      return;
    }
    const existing = await container.shapes.findShapeInRoom(room.id, shapeId);
    if (!existing) {
      res.status(404).json({ message: "Shape not found in this room" });
      return;
    }
    const { shape } = req.body;
    if (!isValidShape(shape)) {
      res.status(400).json({ message: "Invalid shape data" });
      return;
    }
    const updated = await container.shapes.update(room.id, shapeId, shape);
    res.json({ shape: updated });
  });

  app.delete("/rooms/:slug/shapes/:shapeId", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    const shapeId = getParam(req.params.shapeId);
    if (!slug || !shapeId) {
      res.status(400).json({ message: "Invalid slug or shapeId" });
      return;
    }
    const room = await resolveRoomBySlug(slug);
    if (!canEdit(room, req.userId!)) {
      res.status(403).json({ message: "This room is view-only" });
      return;
    }
    const existing = await container.shapes.findShapeInRoom(room.id, shapeId);
    if (!existing) {
      res.status(404).json({ message: "Shape not found in this room" });
      return;
    }
    await container.shapes.delete(room.id, shapeId);
    res.json({ success: true });
  });

  app.post("/rooms/:slug/shapes/delete-many", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoomBySlug(slug);
    if (!canEdit(room, req.userId!)) {
      res.status(403).json({ message: "This room is view-only" });
      return;
    }
    const { shapeIds } = req.body as { shapeIds: string[] };
    if (!Array.isArray(shapeIds)) {
      res.status(400).json({ message: "shapeIds must be an array" });
      return;
    }
    const removed = await container.shapes.deleteMany(room.id, shapeIds);
    res.json({ success: true, removed });
  });

  // --- Chat ---

  app.get("/rooms/:slug/chats", async (req: Request, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoomBySlug(slug);
    const chats = await container.chats.findByRoomId(room.id);
    res.json({ chats });
  });

  app.get("/chats/:roomId", async (req: Request, res: Response) => {
    const roomIdRaw = getParam(req.params.roomId);
    if (!roomIdRaw) {
      res.status(400).json({ message: "Invalid room ID" });
      return;
    }
    const roomId = parseInt(roomIdRaw);
    if (isNaN(roomId)) {
      res.status(400).json({ message: "Invalid room ID" });
      return;
    }
    const chats = await container.chats.findByRoomId(roomId);
    res.json({ chats });
  });

  app.post("/rooms/:slug/chat", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoomBySlug(slug);
    const { message } = req.body as { message: string };
    if (!message || typeof message !== "string") {
      res.status(400).json({ message: "Message is required" });
      return;
    }
    await container.chats.create({ message, userId: req.userId!, roomId: room.id });
    res.status(201).json({ success: true });
  });

  const PORT = process.env.PORT || process.env.HTTP_PORT || 3008;
  app.listen(PORT, () => {
    console.log(`HTTP backend running on port ${PORT}`);
  });
}

main().catch(console.error);