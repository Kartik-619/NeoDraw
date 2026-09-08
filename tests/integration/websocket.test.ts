import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocket, WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { isValidShape } from "@repo/shared-types";
import {
  InMemoryRoomRepository,
  InMemoryChatRepository,
  InMemoryShapeRepository
} from "./helpers/memoryRepositories";

interface TestContainer {
  rooms: InMemoryRoomRepository;
  chats: InMemoryChatRepository;
  shapes: InMemoryShapeRepository;
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

  const broadcastToRoom = (roomSlug: string, payload: unknown, exceptUserId?: string) => {
    users.forEach((u) => {
      if (u.userId !== exceptUserId && u.rooms.includes(roomSlug) && u.ws.readyState === WebSocket.OPEN) {
        u.ws.send(JSON.stringify(payload));
      }
    });
  };

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

        broadcastToRoom(roomSlug, { type: "user_joined", userId: userId!, roomId: roomSlug }, userId!);

        const memberList = users
          .filter((u) => u.rooms.includes(roomSlug) && u.ws.readyState === WebSocket.OPEN)
          .map((u) => u.userId);

        const stored = await container.shapes.findByRoomId(room.id);
        const shapes = stored.map((s) => ({
          ...(s.data as object),
          id: s.id,
          userId: s.userId
        }));

        ws.send(JSON.stringify({ type: "joined_room", roomId: roomSlug, room, members: memberList, shapes }));
      }

      if (parsedData.type === "leave_room") {
        user.rooms = user.rooms.filter((r) => r !== parsedData.roomId);
        broadcastToRoom(parsedData.roomId, { type: "user_left", userId: userId!, roomId: parsedData.roomId });
      }

      if (parsedData.type === "chat") {
        const { roomId, message } = parsedData;
        let room = await container.rooms.findBySlug(roomId);
        if (!room) room = await container.rooms.create({ slug: roomId, adminId: userId! });
        const chat = await container.chats.create({ message, userId: userId!, roomId: room.id });

        broadcastToRoom(roomId, { type: "chat", message, roomId, userId, createdAt: chat.createdAt });
      }

      if (parsedData.type === "shape_add") {
        const roomSlug = parsedData.roomId;
        if (!user.rooms.includes(roomSlug)) return;
        if (!isValidShape(parsedData.shape)) return;
        let room = await container.rooms.findBySlug(roomSlug);
        if (!room) room = await container.rooms.create({ slug: roomSlug, adminId: userId! });

        const persisted = await container.shapes.create({
          roomId: room.id,
          userId: userId!,
          shape: parsedData.shape,
          id: typeof parsedData.shape.id === "string" ? parsedData.shape.id : undefined
        });

        broadcastToRoom(roomSlug, { type: "shape_add", roomId: roomSlug, shape: persisted });
      }

      if (parsedData.type === "shape_update") {
        const roomSlug = parsedData.roomId;
        const shapeId = String(parsedData.shapeId);
        if (!user.rooms.includes(roomSlug)) return;
        if (!isValidShape(parsedData.shape) || !shapeId) return;

        const updated = await container.shapes.update(shapeId, parsedData.shape);
        if (!updated) return;
        broadcastToRoom(roomSlug, { type: "shape_update", roomId: roomSlug, shape: updated });
      }

      if (parsedData.type === "shape_delete") {
        const roomSlug = parsedData.roomId;
        const shapeId = String(parsedData.shapeId);
        if (!user.rooms.includes(roomSlug)) return;
        if (!shapeId) return;
        await container.shapes.remove(shapeId);
        broadcastToRoom(roomSlug, { type: "shape_delete", roomId: roomSlug, shapeId });
      }

      if (parsedData.type === "shape_delete_many") {
        const roomSlug = parsedData.roomId;
        const shapeIds = Array.isArray(parsedData.shapeIds)
          ? parsedData.shapeIds.map(String).filter(Boolean)
          : [];
        if (!user.rooms.includes(roomSlug)) return;
        if (shapeIds.length === 0) return;
        await container.shapes.removeMany(shapeIds);
        broadcastToRoom(roomSlug, { type: "shape_delete_many", roomId: roomSlug, shapeIds });
      }
    });

    ws.on("close", () => {
      if (userId) {
        user.rooms.forEach((roomSlug) => {
          broadcastToRoom(roomSlug, { type: "user_left", userId: userId!, roomId: roomSlug });
        });
      }
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
    while (waiters.length > 0) {
      const waiter = waiters[0];
      const idx = buffer.findIndex((msg) => waiter.types.includes(msg.type));
      if (idx === -1) break;
      const [msg] = buffer.splice(idx, 1);
      const finished = waiter;
      buffer; // keep remaining messages buffered for subsequent waiters
      waiters.shift();
      finished.resolve(msg);
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
      chats: new InMemoryChatRepository(),
      shapes: new InMemoryShapeRepository()
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

  it("includes the current member list in joined_room", async () => {
    const { ws: wsA, waitFor: waitA } = await createClient(address, authToken("user-a"));
    const { ws: wsB, waitFor: waitB } = await createClient(address, authToken("user-b"));
    await waitA("connection");
    await waitB("connection");

    wsA.send(JSON.stringify({ type: "join_room", roomId: "room-1" }));
    await waitA("joined_room");

    const joinedPromise = waitB("joined_room");
    wsB.send(JSON.stringify({ type: "join_room", roomId: "room-1" }));
    const joined = await joinedPromise;

    expect(joined.members).toContain("user-a");
    expect(joined.members).toContain("user-b");

    wsA.close();
    wsB.close();
  });

  it("broadcasts user_joined to existing members when someone joins", async () => {
    const { ws: wsA, waitFor: waitA } = await createClient(address, authToken("user-a"));
    const { ws: wsB, waitFor: waitB } = await createClient(address, authToken("user-b"));
    await waitA("connection");
    await waitB("connection");

    wsA.send(JSON.stringify({ type: "join_room", roomId: "room-1" }));
    await waitA("joined_room");

    const joinedPromise = waitA("user_joined");
    wsB.send(JSON.stringify({ type: "join_room", roomId: "room-1" }));
    const joined = await joinedPromise;

    expect(joined.userId).toBe("user-b");
    expect(joined.roomId).toBe("room-1");

    wsA.close();
    wsB.close();
  });

  it("broadcasts user_left to remaining members when someone leaves", async () => {
    const { ws: wsA, waitFor: waitA } = await createClient(address, authToken("user-a"));
    const { ws: wsB, waitFor: waitB } = await createClient(address, authToken("user-b"));
    await waitA("connection");
    await waitB("connection");

    wsA.send(JSON.stringify({ type: "join_room", roomId: "room-1" }));
    wsB.send(JSON.stringify({ type: "join_room", roomId: "room-1" }));
    await waitA("joined_room");
    await waitB("joined_room");
    // A is notified that B joined; consume it so it doesn't block later waits.
    await waitA("user_joined");

    const leftPromise = waitA("user_left", 8000);
    wsB.close();
    const left = await leftPromise;

    expect(left.userId).toBe("user-b");
    expect(left.roomId).toBe("room-1");

    wsA.close();
  });

  // ---------------- Shape CRUD collaboration ----------------

  it("broadcasts shape_add to members of the same room with a persisted id", async () => {
    const { ws: wsA, waitFor: waitA } = await createClient(address, authToken("user-a"));
    const { ws: wsB, waitFor: waitB } = await createClient(address, authToken("user-b"));
    await waitA("connection");
    await waitB("connection");
    wsA.send(JSON.stringify({ type: "join_room", roomId: "draw-1" }));
    wsB.send(JSON.stringify({ type: "join_room", roomId: "draw-1" }));
    await waitA("joined_room");
    await waitB("joined_room");

    const receivedPromise = waitB("shape_add");
    const clientShape = { type: "rect", id: "shape-rect-1", x: 0, y: 0, width: 50, height: 40 };
    wsA.send(JSON.stringify({ type: "shape_add", roomId: "draw-1", shape: clientShape }));

    const received = await receivedPromise;
    expect(received.roomId).toBe("draw-1");
    expect(received.shape.id).toBe("shape-rect-1");
    expect(received.shape.type).toBe("rect");
    expect(received.shape.userId).toBe("user-a");

    const stored = (container.shapes as InMemoryShapeRepository).all();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe("shape-rect-1");

    wsA.close();
    wsB.close();
  });

  it("rejects invalid shape_add payloads without persisting them", async () => {
    const { ws, waitFor } = await createClient(address, authToken("user-a"));
    await waitFor("connection");
    ws.send(JSON.stringify({ type: "join_room", roomId: "draw-1" }));
    await waitFor("joined_room");

    ws.send(JSON.stringify({ type: "shape_add", roomId: "draw-1", shape: { type: "triangle", x: 0 } }));

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect((container.shapes as InMemoryShapeRepository).all()).toHaveLength(0);

    ws.close();
  });

  it("ignores shape mutations from a user who has not joined the room", async () => {
    const { ws, waitFor } = await createClient(address, authToken("user-a"));
    await waitFor("connection");

    // Never join "locked-room".
    ws.send(JSON.stringify({ type: "shape_add", roomId: "locked-room", shape: { type: "rect", id: "x1", x: 0, y: 0, width: 5, height: 5 } }));
    ws.send(JSON.stringify({ type: "shape_delete", roomId: "locked-room", shapeId: "x1" }));
    ws.send(JSON.stringify({ type: "shape_delete_many", roomId: "locked-room", shapeIds: ["x1"] }));

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect((container.shapes as InMemoryShapeRepository).all()).toHaveLength(0);

    ws.close();
  });

  it("does NOT broadcast shape_add to a user in a different room (room isolation)", async () => {
    const { ws: wsA, waitFor: waitA } = await createClient(address, authToken("user-a"));
    const { ws: wsB, waitFor: waitB } = await createClient(address, authToken("user-b"));
    await waitA("connection");
    await waitB("connection");
    wsA.send(JSON.stringify({ type: "join_room", roomId: "draw-a" }));
    wsB.send(JSON.stringify({ type: "join_room", roomId: "draw-b" }));
    await waitA("joined_room");
    await waitB("joined_room");

    let leaked = false;
    wsB.on("message", (event) => {
      const data = JSON.parse(event.toString());
      if (data.type === "shape_add" && data.roomId === "draw-a") leaked = true;
    });

    wsA.send(JSON.stringify({ type: "shape_add", roomId: "draw-a", shape: { type: "circle", id: "c1", centerX: 1, centerY: 2, radius: 3 } }));

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(leaked).toBe(false);

    wsA.close();
    wsB.close();
  });

  it("sends the persisted shape snapshot to a user joining late", async () => {
    const { ws: wsA, waitFor: waitA } = await createClient(address, authToken("user-a"));
    await waitA("connection");
    wsA.send(JSON.stringify({ type: "join_room", roomId: "snapshot-demo" }));
    await waitA("joined_room");

    wsA.send(JSON.stringify({ type: "shape_add", roomId: "snapshot-demo", shape: { type: "text", id: "txt-1", x: 1, y: 2, text: "hi", fontSize: 20 } }));
    await new Promise((resolve) => setTimeout(resolve, 200));

    const { ws: wsB, waitFor: waitB } = await createClient(address, authToken("user-b"));
    await waitB("connection");
    wsB.send(JSON.stringify({ type: "join_room", roomId: "snapshot-demo" }));
    const joined = await waitB("joined_room");

    expect(joined.shapes).toBeDefined();
    expect(joined.shapes).toHaveLength(1);
    expect(joined.shapes[0]!.id).toBe("txt-1");
    expect(joined.shapes[0]!.type).toBe("text");

    wsA.close();
    wsB.close();
  });

  it("broadcasts shape_update and replaces the stored shape data", async () => {
    const { ws: wsA, waitFor: waitA } = await createClient(address, authToken("user-a"));
    const { ws: wsB, waitFor: waitB } = await createClient(address, authToken("user-b"));
    await waitA("connection");
    await waitB("connection");
    wsA.send(JSON.stringify({ type: "join_room", roomId: "draw-1" }));
    wsB.send(JSON.stringify({ type: "join_room", roomId: "draw-1" }));
    await waitA("joined_room");
    await waitB("joined_room");

    wsA.send(JSON.stringify({ type: "shape_add", roomId: "draw-1", shape: { type: "rect", id: "r1", x: 0, y: 0, width: 10, height: 10 } }));
    await new Promise((resolve) => setTimeout(resolve, 150));

    const updatePromise = waitB("shape_update");
    wsA.send(JSON.stringify({
      type: "shape_update",
      roomId: "draw-1",
      shapeId: "r1",
      shape: { type: "rect", id: "r1", x: 5, y: 5, width: 10, height: 10 }
    }));

    const received = await updatePromise;
    expect(received.shape.id).toBe("r1");
    expect(received.shape.x).toBe(5);

    const stored = (container.shapes as InMemoryShapeRepository).all();
    expect(stored[0]!.data).toMatchObject({ x: 5, y: 5 });

    wsA.close();
    wsB.close();
  });

  it("durably deletes a single shape for every member", async () => {
    const { ws: wsA, waitFor: waitA } = await createClient(address, authToken("user-a"));
    const { ws: wsB, waitFor: waitB } = await createClient(address, authToken("user-b"));
    await waitA("connection");
    await waitB("connection");
    wsA.send(JSON.stringify({ type: "join_room", roomId: "draw-1" }));
    wsB.send(JSON.stringify({ type: "join_room", roomId: "draw-1" }));
    await waitA("joined_room");
    await waitB("joined_room");

    wsA.send(JSON.stringify({ type: "shape_add", roomId: "draw-1", shape: { type: "circle", id: "c1", centerX: 1, centerY: 2, radius: 3 } }));
    await new Promise((resolve) => setTimeout(resolve, 150));

    const deletePromise = waitB("shape_delete");
    wsA.send(JSON.stringify({ type: "shape_delete", roomId: "draw-1", shapeId: "c1" }));

    const received = await deletePromise;
    expect(received.shapeId).toBe("c1");
    expect((container.shapes as InMemoryShapeRepository).all()).toHaveLength(0);

    wsA.close();
    wsB.close();
  });

  it("durably deletes many shapes (eraser) and broadcasts shape_delete_many", async () => {
    const { ws: wsA, waitFor: waitA } = await createClient(address, authToken("user-a"));
    const { ws: wsB, waitFor: waitB } = await createClient(address, authToken("user-b"));
    await waitA("connection");
    await waitB("connection");
    wsA.send(JSON.stringify({ type: "join_room", roomId: "eraser-demo" }));
    wsB.send(JSON.stringify({ type: "join_room", roomId: "eraser-demo" }));
    await waitA("joined_room");
    await waitB("joined_room");

    wsA.send(JSON.stringify({ type: "shape_add", roomId: "eraser-demo", shape: { type: "rect", id: "e1", x: 0, y: 0, width: 50, height: 50 } }));
    wsA.send(JSON.stringify({ type: "shape_add", roomId: "eraser-demo", shape: { type: "rect", id: "e2", x: 200, y: 200, width: 10, height: 10 } }));
    await new Promise((resolve) => setTimeout(resolve, 150));

    const deletePromise = waitB("shape_delete_many");
    wsA.send(JSON.stringify({ type: "shape_delete_many", roomId: "eraser-demo", shapeIds: ["e1", "e2"] }));

    const received = await deletePromise;
    expect(received.shapeIds).toEqual(["e1", "e2"]);
    expect((container.shapes as InMemoryShapeRepository).all()).toHaveLength(0);

    wsA.close();
    wsB.close();
  });

  it("does not leak a deletion to users in another room", async () => {
    const { ws: wsA, waitFor: waitA } = await createClient(address, authToken("user-a"));
    const { ws: wsB, waitFor: waitB } = await createClient(address, authToken("user-b"));
    await waitA("connection");
    await waitB("connection");
    wsA.send(JSON.stringify({ type: "join_room", roomId: "room-a" }));
    wsB.send(JSON.stringify({ type: "join_room", roomId: "room-b" }));
    await waitA("joined_room");
    await waitB("joined_room");

    wsA.send(JSON.stringify({ type: "shape_add", roomId: "room-a", shape: { type: "rect", id: "a1", x: 0, y: 0, width: 10, height: 10 } }));
    await new Promise((resolve) => setTimeout(resolve, 150));

    let leaked = false;
    wsB.on("message", (event) => {
      const data = JSON.parse(event.toString());
      if (data.type === "shape_delete_many" && data.roomId === "room-a") leaked = true;
    });

    wsA.send(JSON.stringify({ type: "shape_delete_many", roomId: "room-a", shapeIds: ["a1"] }));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(leaked).toBe(false);

    wsA.close();
    wsB.close();
  });
});