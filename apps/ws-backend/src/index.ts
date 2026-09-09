import "@repo/backend-common/env";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { parse } from "cookie";
import { In } from "typeorm";
import { JWT_SECRET } from "@repo/backend-common";
import { initializeDatabase, db, toPersistedShape, toRoomInfo, type Room } from "@repo/db";
import { isValidPersistedShape, canEditRoom, type ClientMessage, type ServerShapeMessage } from "@repo/shared-types";
import type { IncomingMessage } from "http";
import { createServer, type Server } from "http";

interface ConnectedUser {
  userId: string;
  rooms: string[];
  ws: WebSocket;
}

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
  let room = await db.rooms().findOne({ where: { slug } });
  if (!room) {
    room = await db.rooms().create({ slug });
    room = await db.rooms().save(room);
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

      // Notify others
      broadcastToRoom(roomId, { type: "user_joined", userId: user.userId, roomId }, user.userId);

      // Send full snapshot to joiner
      const shapes = await db.shapes().find({ where: { roomId: room.id }, order: { createdAt: "ASC" } });
      const persistedShapes = shapes.map(toPersistedShape);
      const members = getRoomMembers(roomId);

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
      broadcastToRoom(roomId, { type: "user_left", userId: user.userId, roomId });
      break;
    }
    case "chat": {
      const { roomId, message } = msg;
      if (!user.rooms.includes(roomId)) return;

      const room = await db.rooms().findOne({ where: { slug: roomId } });
      if (!room) return;

      const chat = db.chats().create({ message, userId: user.userId, roomId: room.id });
      await db.chats().save(chat);

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

      const room = await db.rooms().findOne({ where: { slug: roomId } });
      if (!room || !canEdit(room, user.userId)) return;

      const { id, userId, ...rest } = shape;
      const entity = db.shapes().create({ id, roomId: room.id, userId, data: rest as Record<string, unknown> });
      await db.shapes().save(entity);

      broadcastToRoom(roomId, { type: "shape_add", roomId, shape });
      break;
    }
    case "shape_update": {
      const { roomId, shapeId, shape } = msg;
      if (!user.rooms.includes(roomId)) return;

      const room = await db.rooms().findOne({ where: { slug: roomId } });
      if (!room || !canEdit(room, user.userId)) return;

      const existing = await db.shapes().findOne({ where: { id: shapeId, roomId: room.id } });
      if (!existing) return;

      existing.data = { ...existing.data, ...shape } as Record<string, unknown>;
      await db.shapes().save(existing);

      const updated = toPersistedShape(existing);
      broadcastToRoom(roomId, { type: "shape_update", roomId, shape: updated });
      break;
    }
    case "shape_delete": {
      const { roomId, shapeId } = msg;
      if (!user.rooms.includes(roomId)) return;

      const room = await db.rooms().findOne({ where: { slug: roomId } });
      if (!room || !canEdit(room, user.userId)) return;

      await db.shapes().delete({ id: shapeId, roomId: room.id });
      broadcastToRoom(roomId, { type: "shape_delete", roomId, shapeId });
      break;
    }
    case "shape_delete_many": {
      const { roomId, shapeIds } = msg;
      if (!user.rooms.includes(roomId)) return;

      const room = await db.rooms().findOne({ where: { slug: roomId } });
      if (!room || !canEdit(room, user.userId)) return;

      await db.shapes().delete({ id: In(shapeIds), roomId: room.id });
      broadcastToRoom(roomId, { type: "shape_delete_many", roomId, shapeIds });
      break;
    }
  }
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

async function main(): Promise<void> {
  await initializeDatabase();

  const server: Server = createServer();
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const userId = authenticateToken(req);
    if (!userId) {
      ws.close(1008, "Unauthorized");
      return;
    }

    const user: ConnectedUser = { userId, rooms: [], ws };
    users.set(ws, user);

    send(ws, { type: "connection", userId });

    ws.on("message", (data) => {
      handleMessage(ws, user, data.toString()).catch(console.error);
    });

    ws.on("close", () => {
      // Broadcast user_left for all rooms
      for (const roomId of user.rooms) {
        broadcastToRoom(roomId, { type: "user_left", userId: user.userId, roomId });
      }
      users.delete(ws);
    });
  });

  const PORT = process.env.WS_PORT || 8080;
  server.listen(PORT, () => {
    console.log(`WebSocket backend running on port ${PORT}`);
  });
}

main().catch(console.error);
