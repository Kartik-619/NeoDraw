import { WebSocket, WebSocketServer } from 'ws';
import jwt from "jsonwebtoken";
import { JWT_SECRET } from '@repo/backend-common/config';
import { container } from './application/container';
import { Room } from "@repo/db";
import { toPersistedShape } from "@repo/db";
import { isValidShape, PersistedShape, Shape } from "@repo/shared-types";

interface AuthPayload {
  userId: string;
}

const wss = new WebSocketServer({ port: 8080 });

wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
});

wss.on('listening', () => {
    console.log(`✅ WebSocket server running on port 8080`);
});

interface User {
  ws: WebSocket,
  rooms: string[],
  userId: string
}

const users: User[] = [];

// ✅ COOKIE PARSER
function getTokenFromCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map(c => c.split("="))
  );

  return cookies.token || null;
}

// ✅ AUTH CHECK
function checkUser(token: string | null): string | null {
  try {
    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;

    if (!decoded?.userId) return null;

    return decoded.userId;
  } catch {
    return null;
  }
}

// ✅ ROOM HANDLER
async function getOrCreateRoom(slug: string, userId: string): Promise<Room> {
  let room = await container.rooms.findBySlug(slug);

  if (!room) {
    room = await container.rooms.create({
      slug,
      adminId: userId
    });
  }

  return room;
}

// ✅ BROADCAST HELPER
function broadcastToRoom(roomSlug: string, payload: unknown, exceptUserId?: string) {
  users.forEach(u => {
    if (u.userId !== exceptUserId && u.rooms.includes(roomSlug) && u.ws.readyState === WebSocket.OPEN) {
      u.ws.send(JSON.stringify(payload));
    }
  });
}

// ✅ CONNECTION
wss.on('connection', function connection(ws, request) {
  console.log("New connection");
  const url = new URL(request.url || "/", "ws://localhost");
  const queryToken = url.searchParams.get("token");

  const cookieToken = getTokenFromCookie(request.headers.cookie);

  const token = queryToken || cookieToken;

  const userId = checkUser(token);

  if (!userId) {
    console.log("Auth failed");
    ws.close();
    return;
  }

  const user: User = {
    userId,
    rooms: [],
    ws
  };

  users.push(user);

  console.log(`User ${userId} connected`);

  ws.send(JSON.stringify({
    type: "connection",
    message: "Connected",
    userId
  }));

  ws.on('message', async (data) => {
    let parsedData: Record<string, unknown>;

    try {
      parsedData = JSON.parse(data.toString());
    } catch {
      return;
    }

    // ✅ JOIN ROOM
    if (parsedData.type === "join_room") {
      const roomSlug = String(parsedData.roomId);

      const room = await getOrCreateRoom(roomSlug, userId);

      if (!user.rooms.includes(roomSlug)) {
        user.rooms.push(roomSlug);
      }

      // Notify existing members that a new user has joined
      broadcastToRoom(roomSlug, {
        type: "user_joined",
        userId,
        roomId: roomSlug
      }, userId);

      // Send the current member list + full shape snapshot to the joining user
      const memberList = users.filter(u => u.rooms.includes(roomSlug) && u.ws.readyState === WebSocket.OPEN).map(u => u.userId);

      let shapes: PersistedShape[] = [];
      try {
        const stored = await container.shapes.findByRoomId(room.id);
        shapes = stored.map(toPersistedShape);
      } catch (error) {
        console.error("Failed to load shapes for room:", error);
      }

      ws.send(JSON.stringify({
        type: "joined_room",
        roomId: roomSlug,
        room,
        members: memberList,
        shapes
      }));
    }

    // ✅ LEAVE ROOM
    if (parsedData.type === "leave_room") {
      const roomSlug = String(parsedData.roomId);
      user.rooms = user.rooms.filter(r => r !== roomSlug);

      broadcastToRoom(roomSlug, {
        type: "user_left",
        userId,
        roomId: roomSlug
      });
    }

    // ✅ CHAT
    if (parsedData.type === "chat") {
      const { roomId, message } = parsedData;

      const room = await getOrCreateRoom(String(roomId), userId);

      const chat = await container.chats.create({
        message: String(message),
        userId,
        roomId: room.id
      });

      broadcastToRoom(String(roomId), {
        type: "chat",
        message,
        roomId,
        userId,
        createdAt: chat.createdAt
      });
    }

    // ✅ SHAPE ADD
    if (parsedData.type === "shape_add") {
      const roomSlug = String(parsedData.roomId);
      if (!user.rooms.includes(roomSlug)) return;
      if (!isValidShape(parsedData.shape)) return;

      const room = await getOrCreateRoom(roomSlug, userId);
      const clientShape = parsedData.shape as Shape & { id?: unknown };
      const persisted = await container.shapes.create({
        roomId: room.id,
        userId,
        shape: clientShape,
        id: typeof clientShape.id === "string" ? clientShape.id : undefined
      });

      broadcastToRoom(roomSlug, {
        type: "shape_add",
        roomId: roomSlug,
        shape: persisted
      });
    }

    // ✅ SHAPE UPDATE
    if (parsedData.type === "shape_update") {
      const roomSlug = String(parsedData.roomId);
      const shapeId = String(parsedData.shapeId);
      if (!user.rooms.includes(roomSlug)) return;
      if (!isValidShape(parsedData.shape) || !shapeId) return;

      const updated = await container.shapes.update(shapeId, parsedData.shape);
      if (!updated) return;

      broadcastToRoom(roomSlug, {
        type: "shape_update",
        roomId: roomSlug,
        shape: updated
      });
    }

    // ✅ SHAPE DELETE (single)
    if (parsedData.type === "shape_delete") {
      const roomSlug = String(parsedData.roomId);
      const shapeId = String(parsedData.shapeId);
      if (!user.rooms.includes(roomSlug)) return;
      if (!shapeId) return;

      await container.shapes.remove(shapeId);

      broadcastToRoom(roomSlug, {
        type: "shape_delete",
        roomId: roomSlug,
        shapeId
      });
    }

    // ✅ SHAPE DELETE MANY (eraser)
    if (parsedData.type === "shape_delete_many") {
      const roomSlug = String(parsedData.roomId);
      const shapeIds = Array.isArray(parsedData.shapeIds)
        ? parsedData.shapeIds.map(String).filter(Boolean)
        : [];
      if (!user.rooms.includes(roomSlug)) return;
      if (shapeIds.length === 0) return;

      await container.shapes.removeMany(shapeIds);

      broadcastToRoom(roomSlug, {
        type: "shape_delete_many",
        roomId: roomSlug,
        shapeIds
      });
    }
  });

  ws.on("close", () => {
    // Notify remaining members before removing this user from the room(s)
    user.rooms.forEach(roomSlug => {
      broadcastToRoom(roomSlug, {
        type: "user_left",
        userId,
        roomId: roomSlug
      });
    });

    const index = users.findIndex(x => x.ws === ws);
    if (index !== -1) users.splice(index, 1);

    console.log(`User ${userId} disconnected`);
  });

  ws.on("error", (err) => {
    console.error("WS error:", err);
  });
});