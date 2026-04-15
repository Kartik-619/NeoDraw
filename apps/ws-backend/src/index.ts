import { WebSocket, WebSocketServer } from 'ws';
import jwt from "jsonwebtoken";
import { JWT_SECRET } from '@repo/backend-common/config';
import { db } from "@repo/db";

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

    const decoded: any = jwt.verify(token, JWT_SECRET);

    if (!decoded?.userId) return null;

    return decoded.userId;
  } catch {
    return null;
  }
}

// ✅ ROOM HANDLER (UNCHANGED LOGIC)
async function getOrCreateRoom(slug: string, userId: string) {
  const roomRepo = db.rooms();

  let room = await roomRepo.findOne({
    where: { slug }
  });

  if (!room) {
    room = roomRepo.create({
      slug,
      adminId: userId
    });
    await roomRepo.save(room);
  }

  return room;
}

// ✅ CONNECTION
wss.on('connection', function connection(ws, request) {
  console.log("New connection");

  const token = getTokenFromCookie(request.headers.cookie);
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
    let parsedData;

    try {
      parsedData = JSON.parse(data.toString());
    } catch {
      return;
    }

    // ✅ JOIN ROOM
    if (parsedData.type === "join_room") {
      const roomSlug = parsedData.roomId;

      const room = await getOrCreateRoom(roomSlug, userId);

      if (!user.rooms.includes(roomSlug)) {
        user.rooms.push(roomSlug);
      }

      ws.send(JSON.stringify({
        type: "joined_room",
        roomId: roomSlug,
        room
      }));
    }

    // ✅ LEAVE ROOM
    if (parsedData.type === "leave_room") {
      const roomSlug = parsedData.roomId;
      user.rooms = user.rooms.filter(r => r !== roomSlug);
    }

    // ✅ CHAT
    if (parsedData.type === "chat") {
      const { roomId, message } = parsedData;

      const room = await getOrCreateRoom(roomId, userId);

      const chat = db.chats().create({
        message,
        userId,
        roomId: room.id
      });

      await db.chats().save(chat);

      users.forEach(u => {
        if (u.rooms.includes(roomId) && u.ws.readyState === WebSocket.OPEN) {
          u.ws.send(JSON.stringify({
            type: "chat",
            message,
            roomId,
            userId,
            createdAt: chat.createdAt
          }));
        }
      });
    }
  });

  ws.on("close", () => {
    const index = users.findIndex(x => x.ws === ws);
    if (index !== -1) users.splice(index, 1);

    console.log(`User ${userId} disconnected`);
  });

  ws.on("error", (err) => {
    console.error("WS error:", err);
  });
});