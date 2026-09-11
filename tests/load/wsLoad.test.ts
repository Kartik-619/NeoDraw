import { describe, it, expect, afterEach } from "vitest";
import { createMemoryPersistence, type MemoryPersistenceRef } from "../helpers/memoryPersistence";
import { startTestWsServer, queryTokenAuthenticate, type TestWsServer } from "../helpers/wsServer";
import { openSocket, type WsFixture } from "../helpers/wsClient";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let server: TestWsServer;
let mem: MemoryPersistenceRef;
let fixtures: WsFixture[];

afterEach(async () => {
  for (const f of fixtures) {
    try { f.close(); } catch { /* ignore */ }
  }
  fixtures = [];
  if (server) await server.close();
});

describe("WebSocket load — concurrent connections", () => {
  it("handles 100 simultaneous joins and converges on correct member count", async () => {
    mem = createMemoryPersistence();
    server = await startTestWsServer({
      persistence: mem.persistence,
      authenticate: queryTokenAuthenticate,
    });
    fixtures = [];

    const COUNT = 100;
    const connectPromises = Array.from({ length: COUNT }, (_, i) =>
      openSocket(server.url, `load-user-${i}`),
    );
    const allFixtures = await Promise.all(connectPromises);
    fixtures.push(...allFixtures);

    // All join the same room
    const joinPromises = allFixtures.map((f, i) => {
      f.send({ type: "join_room", roomId: "load-room" });
      return f.waitFor(
        "joined_room",
        (m) => m.type === "joined_room" && m.roomId === "load-room",
      );
    });
    const joinedMessages = await Promise.all(joinPromises);

    // Early joiners see fewer members (joins are concurrent).
    // Wait for all joins to settle, clear messages, then re-join to get the final count.
    await sleep(500);
    allFixtures[0]!.messages.length = 0;
    allFixtures[0]!.send({ type: "join_room", roomId: "load-room" });
    const finalJoin = await allFixtures[0]!.waitFor(
      "joined_room",
      (m) => m.type === "joined_room" && m.roomId === "load-room",
    );
    expect(finalJoin.type).toBe("joined_room");
    if (finalJoin.type === "joined_room") {
      expect(finalJoin.members.length).toBe(COUNT);
    }
  });

  it("presence stays consistent when 50 users disconnect simultaneously", async () => {
    mem = createMemoryPersistence();
    server = await startTestWsServer({
      persistence: mem.persistence,
      authenticate: queryTokenAuthenticate,
    });
    fixtures = [];

    const TOTAL = 50;
    const connectPromises = Array.from({ length: TOTAL }, (_, i) =>
      openSocket(server.url, `disc-${i}`),
    );
    const allFixtures = await Promise.all(connectPromises);
    fixtures.push(...allFixtures);

    // All join
    for (const f of allFixtures) {
      f.send({ type: "join_room", roomId: "disc-room" });
    }
    // Consume all joined_room messages
    await Promise.all(
      allFixtures.map((f) =>
        f.waitFor("joined_room", (m) => m.type === "joined_room" && m.roomId === "disc-room"),
      ),
    );

    // First user stays; rest disconnect
    const stayer = allFixtures[0]!;
    const leavers = allFixtures.slice(1);

    await Promise.all(leavers.map((f) => f.close()));
    await sleep(500);

    // The stayer should eventually see a user_left with the correct remaining list
    const leftMsgs: string[] = [];
    for (const msg of stayer.messages) {
      if (msg.type === "user_left" && msg.roomId === "disc-room") {
        leftMsgs.push(msg.userId);
      }
    }

    // At least some leave events should have arrived
    expect(leftMsgs.length).toBeGreaterThan(0);

    // The last leave event's member list should only contain the stayer
    const lastLeft = stayer.messages.filter(
      (m) => m.type === "user_left" && m.roomId === "disc-room",
    );
    expect(lastLeft.length).toBeGreaterThan(0);
    const finalMsg = lastLeft[lastLeft.length - 1]!;
    expect(finalMsg.type).toBe("user_left");
    if (finalMsg.type === "user_left") {
      expect(new Set(finalMsg.members)).toEqual(new Set(["disc-0"]));
    }
  });

  it("handles rapid shape_add bursts without crashing", async () => {
    mem = createMemoryPersistence();
    server = await startTestWsServer({
      persistence: mem.persistence,
      authenticate: queryTokenAuthenticate,
    });
    fixtures = [];

    const a = await openSocket(server.url, "burst-1");
    const b = await openSocket(server.url, "burst-2");
    fixtures.push(a, b);

    a.send({ type: "join_room", roomId: "burst-room" });
    await a.waitFor("joined_room", (m) => m.type === "joined_room" && m.roomId === "burst-room");
    b.send({ type: "join_room", roomId: "burst-room" });
    await b.waitFor("joined_room", (m) => m.type === "joined_room" && m.roomId === "burst-room");
    // Drain user_joined messages
    await sleep(50);

    const SHAPE_COUNT = 200;

    // Fire all shape_add messages concurrently from user a
    for (let i = 0; i < SHAPE_COUNT; i++) {
      a.send({
        type: "shape_add",
        roomId: "burst-room",
        shape: {
          id: `burst-${i}`,
          userId: "burst-1",
          type: "rect",
          x: i,
          y: i,
          width: 1,
          height: 1,
        },
      });
    }

    // Wait for all shape_add events to arrive at user b
    const deadline = Date.now() + 10000;
    while (b.messages.filter((m) => m.type === "shape_add").length < SHAPE_COUNT) {
      if (Date.now() > deadline) break;
      await sleep(50);
    }

    const received = b.messages.filter((m) => m.type === "shape_add").length;
    expect(received).toBe(SHAPE_COUNT);

    // The server didn't crash — verify we can still send/receive
    a.send({ type: "chat", roomId: "burst-room", message: "still alive" });
    const chat = await b.waitFor("chat", (m) => m.type === "chat" && m.message === "still alive");
    expect(chat.type).toBe("chat");
  });

  it("shape broadcasts reach all members across multiple rooms concurrently", async () => {
    mem = createMemoryPersistence();
    server = await startTestWsServer({
      persistence: mem.persistence,
      authenticate: queryTokenAuthenticate,
    });
    fixtures = [];

    const ROOMS = 5;
    const USERS_PER_ROOM = 10;

    // Create users and join them to rooms
    for (let r = 0; r < ROOMS; r++) {
      for (let u = 0; u < USERS_PER_ROOM; u++) {
        const f = await openSocket(server.url, `multi-${r}-${u}`);
        fixtures.push(f);
        f.send({ type: "join_room", roomId: `multi-room-${r}` });
      }
    }

    // Wait for all joins to settle
    await sleep(500);

    // Each room's first user adds a shape
    for (let r = 0; r < ROOMS; r++) {
      const senderIdx = r * USERS_PER_ROOM;
      const sender = fixtures[senderIdx]!;
      sender.send({
        type: "shape_add",
        roomId: `multi-room-${r}`,
        shape: {
          id: `shape-${r}`,
          userId: `multi-${r}-0`,
          type: "rect",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        },
      });
    }

    // Wait for propagation
    await sleep(500);

    // Each room's other users should have exactly 1 shape_add, and no cross-room contamination
    for (let r = 0; r < ROOMS; r++) {
      for (let u = 1; u < USERS_PER_ROOM; u++) {
        const idx = r * USERS_PER_ROOM + u;
        const f = fixtures[idx]!;
        const shapeAdds = f.messages.filter(
          (m) => m.type === "shape_add" && m.roomId === `multi-room-${r}`,
        );
        expect(shapeAdds.length).toBe(1);
        if (shapeAdds[0]!.type === "shape_add") {
          expect(shapeAdds[0]!.shape.id).toBe(`shape-${r}`);
        }

        // Must NOT have received shapes from other rooms
        const otherRoomAdds = f.messages.filter(
          (m) => m.type === "shape_add" && m.roomId !== `multi-room-${r}`,
        );
        expect(otherRoomAdds.length).toBe(0);
      }
    }
  });
});