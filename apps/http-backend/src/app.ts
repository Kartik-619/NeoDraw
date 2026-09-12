import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { CreateUserSchema, SignInSchema, CreateRoomSchema } from "@repo/common";
import { JWT_SECRET } from "@repo/backend-common";
import { isValidShape, isValidPersistedShape, newId, canEditRoom, type EditPermission } from "@repo/shared-types";
import type { Container } from "./application/container.js";
import type { RoomRecord } from "./application/repositories.js";
import { authMiddleware, type AuthRequest } from "./middleware.js";

export function createApp(container: Container): express.Express {
  const app = express();

  function getParam(value: string | string[] | undefined): string | null {
    return typeof value === "string" ? value : null;
  }

  const allowedOrigin = (process.env.FRONTEND_ORIGIN || "http://localhost:3000").replace(/\/+$/, "");

  app.use(cors({
    origin(origin, callback) {
      if (!origin || origin === allowedOrigin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
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

  // List rooms where the current user is admin or a member
  app.get("/rooms", authMiddleware, async (req: AuthRequest, res: Response) => {
    const rooms = await container.rooms.findAccessibleByUser(req.userId!);
    res.json({ rooms });
  });

  // Resolve room by slug (must exist; requires membership or ownership)
  async function resolveRoom(slug: string): Promise<RoomRecord | null> {
    return container.rooms.findBySlug(slug);
  }

  function canEdit(room: RoomRecord, userId: string): boolean {
    return canEditRoom(room.editPermission, room.adminId ?? null, userId);
  }

  async function canAccess(room: RoomRecord, userId: string): Promise<boolean> {
    if (room.adminId === userId) return true;
    return container.members.isMember(room.id, userId);
  }

  app.get("/room/:slug", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoom(slug);
    if (!room || !(await canAccess(room, req.userId!))) {
      res.status(404).json({ message: "Room not found" });
      return;
    }
    res.json({ roomId: room.id, slug: room.slug, adminId: room.adminId, editPermission: room.editPermission });
  });

  // Update room sharing permission (admin only)
  app.patch("/rooms/:slug/permissions", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoom(slug);
    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }
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

  app.get("/rooms/:slug/shapes", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoom(slug);
    if (!room || !(await canAccess(room, req.userId!))) {
      res.status(404).json({ message: "Room not found" });
      return;
    }
    const shapes = await container.shapes.findByRoomId(room.id);
    res.json({ shapes });
  });

  app.post("/rooms/:slug/shapes", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoom(slug);
    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }
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
    const room = await resolveRoom(slug);
    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }
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
    const room = await resolveRoom(slug);
    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }
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
    const room = await resolveRoom(slug);
    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return;
    }
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

  app.get("/rooms/:slug/chats", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoom(slug);
    if (!room || !(await canAccess(room, req.userId!))) {
      res.status(404).json({ message: "Room not found" });
      return;
    }
    const chats = await container.chats.findByRoomId(room.id);
    res.json({ chats });
  });

  app.get("/chats/:roomId", authMiddleware, async (req: AuthRequest, res: Response) => {
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
    const room = await container.rooms.findById(roomId);
    if (!room || !(await canAccess(room, req.userId!))) {
      res.status(404).json({ message: "Room not found" });
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
    const room = await resolveRoom(slug);
    if (!room || !(await canAccess(room, req.userId!))) {
      res.status(404).json({ message: "Room not found" });
      return;
    }
    const { message } = req.body as { message: string };
    if (!message || typeof message !== "string") {
      res.status(400).json({ message: "Message is required" });
      return;
    }
    await container.chats.create({ message, userId: req.userId!, roomId: room.id });
    res.status(201).json({ success: true });
  });

  // --- Room members (owner only) ---

  function requireRoom(res: Response, room: RoomRecord | null, userId: string | undefined): room is RoomRecord {
    if (!room) {
      res.status(404).json({ message: "Room not found" });
      return false;
    }
    if (room.adminId !== userId) {
      res.status(403).json({ message: "Only the room owner can manage members" });
      return false;
    }
    return true;
  }

  app.get("/rooms/:slug/members", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoom(slug);
    if (!requireRoom(res, room, req.userId)) return;
    const members = await container.members.findEmailsForRoom(room.id);
    res.json({ members });
  });

  app.post("/rooms/:slug/members", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    if (!slug) {
      res.status(400).json({ message: "Invalid slug" });
      return;
    }
    const room = await resolveRoom(slug);
    if (!requireRoom(res, room, req.userId)) return;

    const emailRaw = (req.body as { email?: unknown }).email;
    if (typeof emailRaw !== "string" || !emailRaw.includes("@")) {
      res.status(400).json({ message: "A valid email is required" });
      return;
    }
    const email = emailRaw.trim().toLowerCase();
    const user = await container.users.findByEmail(email);
    if (!user) {
      res.status(404).json({ message: "No account found for that email" });
      return;
    }
    if (user.id === room.adminId) {
      res.status(400).json({ message: "The owner is already a member" });
      return;
    }
    if (await container.members.isMember(room.id, user.id)) {
      res.status(409).json({ message: "That user is already a member" });
      return;
    }
    await container.members.add(room.id, user.id);
    res.status(201).json({ userId: user.id, email: user.email });
  });

  app.delete("/rooms/:slug/members/:userId", authMiddleware, async (req: AuthRequest, res: Response) => {
    const slug = getParam(req.params.slug);
    const memberId = getParam(req.params.userId);
    if (!slug || !memberId) {
      res.status(400).json({ message: "Invalid slug or userId" });
      return;
    }
    const room = await resolveRoom(slug);
    if (!requireRoom(res, room, req.userId)) return;

    if (memberId === room.adminId) {
      res.status(400).json({ message: "The owner cannot be removed" });
      return;
    }
    if (!(await container.members.isMember(room.id, memberId))) {
      res.status(404).json({ message: "Not a member of this room" });
      return;
    }
    await container.members.remove(room.id, memberId);
    res.json({ success: true });
  });

  return app;
}