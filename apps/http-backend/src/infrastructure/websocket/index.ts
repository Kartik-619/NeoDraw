import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { parse } from "cookie";
import { In } from "typeorm";
import { JWT_SECRET } from "@repo/backend-common";
import { db, toPersistedShape, toRoomInfo, type Room, type RoomShape, type Chat } from "@repo/db";
import { isValidPersistedShape, canEditRoom, type ClientMessage, type ServerShapeMessage } from "@repo/shared-types";
import type { IncomingMessage } from "http";
import { createServer, type Server } from "http";

interface ConnectedUser {
  userId: string;
  rooms: string[];
  ws: WebSocket;
  queue: Promise<void>;
}

// --- Persistence abstraction (structurally matches @repo/db repositories) ---

export interface RoomStore {
  findOne(opts: { where: { slug: string } }): Promise<Room | null>;
  create(data: { slug: string; adminId?: string }): Room;
  save(room: Room): Promise<Room>;
}

export interface ShapeStore {
  find(opts: { where: { roomId: number }; order: { createdAt: "ASC" } }): Promise<RoomShape[]>;
  findOne(opts: { where: { id: string; roomId: number } }): Promise<RoomShape | null>;
  create(data: { id: string; roomId: number; userId: string; data: Record<string, unknown> }): RoomShape;
  save(shape: RoomShape): Promise<RoomShape>;
  delete(criteria: { id?: string | string[]; roomId?: number }): Promise<unknown>;
}

export interface ChatStore {
  create(data: { message: string; userId: string; roomId: number }): Chat;
  save(chat: Chat): Promise<Chat>;
}

export interface Persistence {
  rooms: RoomStore;
  shapes: ShapeStore;
  chats: ChatStore;
}

export interface WsServerDeps {
  server?: Server;
  persistence: Persistence;
  authenticate?: (req: IncomingMessage) => string | null;
}

export interface WsServerHandle {
  wss: WebSocketServer;
  server: Server;
  close(): Promise<void>;
}

function authenticateToken(req: IncomingMessage): string | null {
  // Try cookie first
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = parse(cookieHeader);
    if (cookies.token) {
      try {
        const payload = jwt.verify(cookies.token, JWT_SECRET) as { userId: string };
        return payload.userId;
      } catch { /* continue */ }
    }
  }

  // Try query string
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      return payload.userId;
    } catch { /* invalid */ }
  }

  return null;
}

export async function createWsServer(deps: WsServerDeps): Promise<WsServerHandle> {
  const { persistence } = deps;
  const authenticate = deps.authenticate ?? authenticateToken;

  const server: Server = deps.server ?? createServer();
  const wss = new WebSocketServer({ server });
  const users: Map<WebSocket, ConnectedUser> = new Map();

  function send(ws: WebSocket, msg: ServerShapeMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function broadcastToRoom(roomSlug: string, msg: ServerShapeMessage, exceptUserId?: string): void {
    for (const [, user] of users) {
      if (user.rooms.includes(roomSlug) && user.ws.readyState === WebSocket.OPEN && user.userId !== exceptUserId) {
        send(user.ws, msg);
      }
    }
  }

  function getRoomMembers(roomSlug: string): string[] {
    const memberSet = new Set<string>();
    for (const [, user] of users) {
      if (user.rooms.includes(roomSlug)) {
        memberSet.add(user.userId);
      }
    }
    return Array.from(memberSet);
  }

  async function resolveRoomBySlug(slug: string) {
    let room = await persistence.rooms.findOne({ where: { slug } });
    if (!room) {
      room = await persistence.rooms.create({ slug });
      room = await persistence.rooms.save(room);
    }
    return room;
  }

  function canEdit(room: Room, userId: string): boolean {
    return canEditRoom(room.editPermission, room.adminId ?? null, userId);
  }

  async function handleMessage(ws: WebSocket, user: ConnectedUser, raw: string): Promise<void> {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case "join_room": {
        const { roomId } = msg;
        const room = await resolveRoomBySlug(roomId);

        if (!user.rooms.includes(roomId)) {
          user.rooms.push(roomId);
        }

        const members = getRoomMembers(roomId);

        // Notify others with the authoritative, deduplicated member list
        broadcastToRoom(roomId, { type: "user_joined", userId: user.userId, roomId, members }, user.userId);

        // Send full snapshot to joiner
        const shapes = await persistence.shapes.find({ where: { roomId: room.id }, order: { createdAt: "ASC" } });
        const persistedShapes = shapes.map(toPersistedShape);

        send(ws, {
          type: "joined_room",
          roomId,
          room: toRoomInfo(room),
          members,
          shapes: persistedShapes,
        });
        break;
      }
      case "leave_room": {
        const { roomId } = msg;
        user.rooms = user.rooms.filter(r => r !== roomId);
        const members = getRoomMembers(roomId);
        broadcastToRoom(roomId, { type: "user_left", userId: user.userId, roomId, members });
        break;
      }
      case "chat": {
        const { roomId, message } = msg;
        if (!user.rooms.includes(roomId)) return;

        const room = await persistence.rooms.findOne({ where: { slug: roomId } });
        if (!room) return;

        const chat = await persistence.chats.create({ message, userId: user.userId, roomId: room.id });
        await persistence.chats.save(chat);

        broadcastToRoom(roomId, {
          type: "chat",
          message,
          roomId,
          userId: user.userId,
          createdAt: new Date().toISOString(),
        });
        break;
      }
      case "shape_add": {
        const { roomId, shape } = msg;
        if (!user.rooms.includes(roomId)) return;
        if (!isValidPersistedShape(shape)) return;

        const room = await persistence.rooms.findOne({ where: { slug: roomId } });
        if (!room || !canEdit(room, user.userId)) return;

        const { id, userId, ...rest } = shape;
        await persistence.shapes.create({ id, roomId: room.id, userId, data: rest as Record<string, unknown> });

        broadcastToRoom(roomId, { type: "shape_add", roomId, shape }, user.userId);
        break;
      }
      case "shape_update": {
        const { roomId, shapeId, shape } = msg;
        if (!user.rooms.includes(roomId)) return;

        const room = await persistence.rooms.findOne({ where: { slug: roomId } });
        if (!room || !canEdit(room, user.userId)) return;

        const existing = await persistence.shapes.findOne({ where: { id: shapeId, roomId: room.id } });
        if (!existing) return;

        existing.data = { ...existing.data, ...shape } as Record<string, unknown>;
        await persistence.shapes.save(existing);

        const updated = toPersistedShape(existing);
        broadcastToRoom(roomId, { type: "shape_update", roomId, shape: updated }, user.userId);
        break;
      }
      case "shape_delete": {
        const { roomId, shapeId } = msg;
        if (!user.rooms.includes(roomId)) return;

        const room = await persistence.rooms.findOne({ where: { slug: roomId } });
        if (!room || !canEdit(room, user.userId)) return;

        await persistence.shapes.delete({ id: shapeId, roomId: room.id });
        broadcastToRoom(roomId, { type: "shape_delete", roomId, shapeId }, user.userId);
        break;
      }
      case "shape_delete_many": {
        const { roomId, shapeIds } = msg;
        if (!user.rooms.includes(roomId)) return;

        const room = await persistence.rooms.findOne({ where: { slug: roomId } });
        if (!room || !canEdit(room, user.userId)) return;

        await persistence.shapes.delete({ id: shapeIds, roomId: room.id });
        broadcastToRoom(roomId, { type: "shape_delete_many", roomId, shapeIds }, user.userId);
        break;
      }
    }
  }

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const userId = authenticate(req);
    if (!userId) {
      ws.close(1008, "Unauthorized");
      return;
    }

    const user: ConnectedUser = { userId, rooms: [], ws, queue: Promise.resolve() };
    users.set(ws, user);

    send(ws, { type: "connection", userId });

    ws.on("message", (data) => {
      const raw = data.toString();
      user.queue = user.queue
        .then(() => handleMessage(ws, user, raw))
        .catch(console.error);
    });

    ws.on("close", () => {
      // Remove first so member lists no longer include the departed socket
      users.delete(ws);
      // Broadcast user_left for all rooms with the authoritative member list
      for (const roomId of user.rooms) {
        const members = getRoomMembers(roomId);
        broadcastToRoom(roomId, { type: "user_left", userId: user.userId, roomId, members });
      }
    });
  });

  async function close(): Promise<void> {
    for (const [, user] of users) {
      user.ws.terminate();
    }
    users.clear();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  return { wss, server, close };
}

export function dbPersistence(): Persistence {
  return {
    rooms: {
      findOne: (opts) => db.rooms().findOne(opts),
      create: (data) => db.rooms().create(data),
      save: (room) => db.rooms().save(room),
    },
    shapes: {
      find: (opts) => db.shapes().find(opts),
      findOne: (opts) => db.shapes().findOne(opts),
      create: (data) => db.shapes().create(data),
      save: (shape) => db.shapes().save(shape),
      delete: async ({ id, roomId }) => {
        if (Array.isArray(id)) {
          return db.shapes().delete({ id: In(id), roomId });
        }
        return db.shapes().delete({ id, roomId });
      },
    },
    chats: {
      create: (data) => db.chats().create(data),
      save: (chat) => db.chats().save(chat),
    },
  };
}