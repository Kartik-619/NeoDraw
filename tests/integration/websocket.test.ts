import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import {
  InMemoryRoomRepository,
  InMemoryChatRepository
} from "./helpers/memoryRepositories";

interface TestContainer {
  rooms: InMemoryRoomRepository;
  chats: InMemoryChatRepository;
}

function authToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET);
}

// Replicates the real WS backend (apps/ws-backend/src/index.ts) but with injected
// in-memory repositories so it runs without a database.
function startWsServer(container: TestContainer) {
  const wss = new WebSocketServer({ port: 0 });

  interface ConnectedUser {
    ws: WebSocket;
    rooms: string[];
    userId: string;
  }

  const users: ConnectedUser[] = [];

  wss.on("connection", (ws, request) => {
    const url = new URL(request.url || "/", "ws://localhost");
    const token = url.searchParams.get("token");
    let userId: string | null = null;
    try {
      const decoded = jwt.verify(token || "", JWT_SECRET) as { userId: string };
      userId = decoded?.userId ?? null;
    } catch {
      userId = null;
    }

    if (!userId) {
      ws.close();
      return;
    }
    const user: ConnectedUser = { userId, rooms: [], ws };
    users.push(user);

    ws.send(JSON.stringify({ type: "connection", message: "Connected", userId }));

    ws.on("message", async (data) => {
      let parsedData: any;
      try {
        parsedData = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (parsedData.type === "join_room") {
        const roomSlug = parsedData.roomId;
        let room = await container.rooms.findBySlug(roomSlug);
        if (!room) room = await container.rooms.create({ slug: roomSlug, adminId: userId! });
        if (!user.rooms.includes(roomSlug)) user.rooms.push(roomSlug);
        ws.send(JSON.stringify({ type: "joined_room", roomId: roomSlug, room }));
      }

      if (parsedData.type === "leave_room") {
        user.rooms = user.rooms.filter((r) => r !== parsedData.roomId);
      }

      if (parsedData.type === "chat") {
        const { roomId, message } = parsedData;
        let room = await container.rooms.findBySlug(roomId);
        if (!room) room = await container.rooms.create({ slug: roomId, adminId: userId! });
        const chat = await container.chats.create({ message, userId: userId!, roomId: room.id });

        users.forEach((u) => {
          if (u.rooms.includes(roomId) && u.ws.readyState === WebSocket.OPEN) {
            u.ws.send(JSON.stringify({ type: "chat", message, roomId, userId, createdAt: chat.createdAt }));
          }
        });
      }
    });

    ws.on("close", () => {
      const idx = users.findIndex((x) => x.ws === ws);
      if (idx !== -1) users.splice(idx, 1);
    });
  });

  return wss;
}

// A connected client that buffers every incoming message immediately (so no
// race with the initial "connection" handshake) and exposes waitFor(type).
async function createClient(address: string, token: string) {
  const ws = new WebSocket(`${address}?token=${token}`);
  const buffer: any[] = [];
  type Waiter = { types: string[]; resolve: (m: any) => void; reject: (e: any) => void };
  const waiters: Waiter[] = [];

  const dispatch = () => {
    while (buffer.length > 0 && waiters.length > 0) {
      const msg = buffer[0];
      const waiter = waiters[0];
      if (waiter && waiter.types.includes(msg.type)) {
        buffer.shift();
        waiters.shift();
        waiter.resolve(msg);
      } else {
        break;
      }
    }
  };

  ws.on("message", (data: unknown & { toString?: () => string }) => {
    let text: string;
    if (Buffer.isBuffer(data)) {
      text = data.toString();
    } else if (typeof data === "string") {
      text = data;
    } else {
      text = String(data);
    }
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    buffer.push(parsed);
    dispatch();
  });

  ws.on("error", (err) => {
    const waiter = waiters.shift();
    if (waiter) waiter.reject(err);
  });

  await new Promise<void>((resolve, reject) => {
    ws.on("open", () => resolve());
    ws.on("error", reject);
  });

  const waitFor = (type: string, timeout = 3000): Promise<any> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), timeout);
      const finish = (m: any) => {
        clearTimeout(timer);
        resolve(m);
      };
      waiters.push({ types: [type], resolve: finish, reject });
      dispatch();
    });

  return { ws, waitFor };
}

describe("WebSocket collaboration integration", () => {
  let container: TestContainer;
  let wss: WebSocketServer;
  let address: string;

  beforeEach(async () => {
    container = {
      rooms: new InMemoryRoomRepository(),
      chats: new InMemoryChatRepository()
    };
    wss = startWsServer(container);
    await new Promise<void>((resolve) => wss.on("listening", () => resolve()));
    const port = (wss.address() as any).port;
    address = `ws://localhost:${port}`;
  });

  afterEach(() => {
    if (wss) {
      wss.clients.forEach((c) => c.close());
      wss.close();
    }
  });

  it("rejects a connection without a valid token", async () => {
    const ws = new WebSocket(`${address}?token=invalid`);
    const closed = await new Promise<{ code: number }>((resolve) => {
      ws.on("close", (code) => resolve({ code }));
    });
    expect(closed.code).toBe(1005); // or 1006 normal without status
    ws.terminate();
  });

  it("accepts a connection with a valid token and receives the connection event", async () => {
    const { ws, waitFor } = await createClient(address, authToken("user-1"));
    const conn = await waitFor("connection");
    expect(conn.message).toBe("Connected");
    expect(conn.userId).toBe("user-1");
    ws.close();
  });

  it("joins a room and receives joined_room", async () => {
    const { ws, waitFor } = await createClient(address, authToken("user-1"));
    await waitFor("connection");

    ws.send(JSON.stringify({ type: "join_room", roomId: "design-room" }));
    const joined = await waitFor("joined_room");
    expect(joined.roomId).toBe("design-room");
    expect(joined.room.slug).toBe("design-room");
    ws.close();
  });

  it("creates the room in storage on join", async () => {
    const { ws, waitFor } = await createClient(address, authToken("user-1"));
    await waitFor("connection");
    ws.send(JSON.stringify({ type: "join_room", roomId: "design-room" }));
    await waitFor("joined_room");

    const stored = await container.rooms.findBySlug("design-room");
    expect(stored).not.toBeNull();
    expect(stored!.adminId).toBe("user-1");
    ws.close();
  });

  it("broadcasts a chat message to users in the same room", async () => {
    const { ws: wsA, waitFor: waitA } = await createClient(address, authToken("user-a"));
    const { ws: wsB, waitFor: waitB } = await createClient(address, authToken("user-b"));
    await waitA("connection");
    await waitB("connection");

    wsA.send(JSON.stringify({ type: "join_room", roomId: "room-1" }));
    wsB.send(JSON.stringify({ type: "join_room", roomId: "room-1" }));
    await waitA("joined_room");
    await waitB("joined_room");

    const receivedPromise = waitB("chat");
    wsA.send(JSON.stringify({ type: "chat", roomId: "room-1", message: "hello everyone" }));

    const received = await receivedPromise;
    expect(received.message).toBe("hello everyone");
    expect(received.roomId).toBe("room-1");
    expect(received.userId).toBe("user-a");

    wsA.close();
    wsB.close();
  });

  it("does NOT broadcast chat to a user not in the room", async () => {
    const { ws: wsA, waitFor: waitA } = await createClient(address, authToken("user-a"));
    const { ws: wsB, waitFor: waitB } = await createClient(address, authToken("user-b"));
    await waitA("connection");
    await waitB("connection");

    wsA.send(JSON.stringify({ type: "join_room", roomId: "room-1" }));
    await waitA("joined_room");
    // wsB joins a different room

    wsB.send(JSON.stringify({ type: "join_room", roomId: "room-2" }));
    await waitB("joined_room");

    let received = false;
    wsB.on("message", (event) => {
      const data = JSON.parse(event.toString());
      if (data.type === "chat" && data.roomId === "room-1") received = true;
    });

    wsA.send(JSON.stringify({ type: "chat", roomId: "room-1", message: "secret" }));

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received).toBe(false);

    wsA.close();
    wsB.close();
  });

  it("persists chat messages to the repository", async () => {
    const { ws, waitFor } = await createClient(address, authToken("user-1"));
    await waitFor("connection");
    ws.send(JSON.stringify({ type: "join_room", roomId: "room-1" }));
    await waitFor("joined_room");

    ws.send(JSON.stringify({ type: "chat", roomId: "room-1", message: "persisted?" }));
    await new Promise((resolve) => setTimeout(resolve, 300));

    const chats = (container.chats as InMemoryChatRepository).all();
    expect(chats.length).toBe(1);
    expect(chats[0]!.message).toBe("persisted?");

    ws.close();
  });
});
