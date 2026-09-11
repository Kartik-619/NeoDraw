import { describe, it, expect, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common";
import { createMemoryPersistence, type MemoryPersistenceRef } from "../helpers/memoryPersistence";
import { startTestWsServer, queryTokenAuthenticate, type TestWsServer } from "../helpers/wsServer";
import { openSocket, type WsFixture } from "../helpers/wsClient";
import type { PersistedShape } from "@repo/shared-types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Ctx {
  mem: MemoryPersistenceRef;
  server: TestWsServer;
  fixtures: WsFixture[];
}

let ctx: Ctx;

beforeEach(async () => {
  const mem = createMemoryPersistence();
  const server = await startTestWsServer({
    persistence: mem.persistence,
    authenticate: queryTokenAuthenticate,
  });
  ctx = { mem, server, fixtures: [] };
});

afterEach(async () => {
  for (const f of ctx.fixtures) {
    try {
      f.close();
    } catch {
      /* ignore */
    }
  }
  await ctx.server.close();
});

async function connect(userId: string, timeoutMs?: number): Promise<WsFixture> {
  const f = await openSocket(ctx.server.url, userId, timeoutMs);
  ctx.fixtures.push(f);
  return f;
}

async function join(
  fixture: WsFixture,
  roomId: string,
): Promise<{ members: string[]; shapes: PersistedShape[] }> {
  fixture.send({ type: "join_room", roomId });
  const joined = await fixture.waitFor(
    "joined_room",
    (m) => m.type === "joined_room" && m.roomId === roomId,
  );
  if (joined.type !== "joined_room") throw new Error("unexpected message");
  return { members: joined.members, shapes: joined.shapes };
}

describe("WebSocket backend — authentication", () => {
  it("connects and authenticates with a valid JWT", async () => {
    const mem = createMemoryPersistence();
    const jwtServer = await startTestWsServer({ persistence: mem.persistence });
    const token = jwt.sign({ userId: "jwt-user" }, JWT_SECRET, { expiresIn: "1h" });
    const f = await openSocket(jwtServer.url, token);
    const conn = await f.waitFor("connection");
    expect(conn.type).toBe("connection");
    if (conn.type === "connection") expect(conn.userId).toBe("jwt-user");
    await f.close();
    await jwtServer.close();
  });

  it("rejects connections without a valid token", async () => {
    const { WebSocket } = await import("ws");
    const ws = new WebSocket(ctx.server.url);
    const closeCode = await new Promise<number | undefined>((resolve, reject) => {
      const t = setTimeout(() => {
        reject(new Error("socket did not close"));
      }, 3000);
      ws.on("close", (code) => {
        clearTimeout(t);
        resolve(code);
      });
      ws.on("error", () => {
        clearTimeout(t);
        resolve(1008);
      });
    });
    expect(closeCode).toBe(1008);
  });
});

describe("WebSocket backend — presence", () => {
  it("reports a deduplicated member list on join", async () => {
    const a = await connect("u1");
    const { members: m1 } = await join(a, "room-1");
    expect(m1).toContain("u1");

    const b = await connect("u2");
    const { members: m2 } = await join(b, "room-1");
    expect(new Set(m2)).toEqual(new Set(["u1", "u2"]));
  });

  it("broadcasts user_joined to existing members with the authoritative member list", async () => {
    const a = await connect("u1");
    await join(a, "room-1");

    const b = await connect("u2");
    await join(b, "room-1");

    const msg = await a.waitFor("user_joined");
    expect(msg.type).toBe("user_joined");
    if (msg.type === "user_joined") {
      expect(msg.userId).toBe("u2");
      expect(new Set(msg.members)).toEqual(new Set(["u1", "u2"]));
    }
  });

  it("regression: duplicate sockets never inflate the member count beyond unique users", async () => {
    // Host u1 joins first.
    const a = await connect("u1");
    await join(a, "room-7");

    // Guest u2 opens TWO sockets to the same room.
    const b1 = await connect("u2");
    const { members: guestView1 } = await join(b1, "room-7");

    const b2 = await connect("u2");
    const { members: guestView2 } = await join(b2, "room-7");

    // The guest's snapshot must never exceed the unique user count.
    expect([...guestView1].sort()).toEqual(["u1", "u2"]);
    expect([...guestView2].sort()).toEqual(["u1", "u2"]);

    // The host observes two join events, but each ships the deduplicated list.
    const joinOne = await a.waitFor("user_joined");
    const joinTwo = await a.waitFor("user_joined");
    expect(joinOne.type).toBe("user_joined");
    expect(joinTwo.type).toBe("user_joined");
    if (joinOne.type === "user_joined") expect(joinOne.members.length).toBe(2);
    if (joinTwo.type === "user_joined") expect(joinTwo.members.length).toBe(2);

    // Dropping one duplicate socket must NOT decrement below the real membership.
    await b2.close();
    const leftMsg = await a.waitFor("user_left");
    expect(leftMsg.type).toBe("user_left");
    if (leftMsg.type === "user_left") {
      expect(leftMsg.userId).toBe("u2");
      expect(new Set(leftMsg.members)).toEqual(new Set(["u1", "u2"]));
    }
  });

  it("broadcasts user_left with the remaining deduplicated member list", async () => {
    const a = await connect("u1");
    await join(a, "room-2");
    const b = await connect("u2");
    await join(b, "room-2");
    const c = await connect("u3");
    await join(c, "room-2");

    b.send({ type: "leave_room", roomId: "room-2" });

    const msg = await a.waitFor("user_left");
    expect(msg.type).toBe("user_left");
    if (msg.type === "user_left") {
      expect(msg.userId).toBe("u2");
      expect(new Set(msg.members)).toEqual(new Set(["u1", "u3"]));
    }
  });

  it("broadcasts user_left for every room when a socket disconnects", async () => {
    const a = await connect("u1");
    await join(a, "room-a");
    await join(a, "room-b");

    const inA = await connect("u2");
    await join(inA, "room-a");
    const inB = await connect("u3");
    await join(inB, "room-b");

    await a.close();

    const leftA = await inA.waitFor("user_left");
    expect(leftA.type).toBe("user_left");
    if (leftA.type === "user_left") {
      expect(leftA.roomId).toBe("room-a");
      expect(new Set(leftA.members)).toEqual(new Set(["u2"]));
    }

    const leftB = await inB.waitFor("user_left");
    expect(leftB.type).toBe("user_left");
    if (leftB.type === "user_left") {
      expect(leftB.roomId).toBe("room-b");
      expect(new Set(leftB.members)).toEqual(new Set(["u3"]));
    }
  });
});

describe("WebSocket backend — room isolation and shapes", () => {
  it("scopes shape events to members of the room", async () => {
    const a = await connect("u1");
    await join(a, "room-red");

    const b = await connect("u2");
    await join(b, "room-blue");

    const c = await connect("u3");
    await join(c, "room-red");

    const shape = { id: "s1", userId: "u1", type: "rect", x: 1, y: 2, width: 3, height: 4 };
    a.send({ type: "shape_add", roomId: "room-red", shape });

    const gotC = await c.waitFor("shape_add");
    expect(gotC.type).toBe("shape_add");
    if (gotC.type === "shape_add") expect(gotC.shape.id).toBe("s1");

    // A member of a different room must never see it.
    await sleep(300);
    expect(b.messages.some((m) => m.type === "shape_add")).toBe(false);
  });

  it("silently ignores shape ops from users who are not members of the room", async () => {
    const a = await connect("u1");
    await join(a, "room-guarded");

    const intruder = await connect("u9");
    intruder.send({
      type: "shape_add",
      roomId: "room-guarded",
      shape: { id: "s2", userId: "u9", type: "circle", centerX: 0, centerY: 0, radius: 5 },
    });

    await sleep(300);
    expect(a.messages.some((m) => m.type === "shape_add")).toBe(false);
  });

  it("snapshots persisted shapes to a joining client", async () => {
    const room = ctx.mem.rooms.seed({ slug: "snap-room" });
    ctx.mem.shapes.create({
      id: "persisted-1",
      roomId: room.id,
      userId: "owner",
      data: { type: "rect", x: 1, y: 1, width: 2, height: 2 },
    });

    const a = await connect("owner");
    const { shapes } = await join(a, "snap-room");
    expect(shapes).toHaveLength(1);
    expect(shapes[0]!.id).toBe("persisted-1");
  });

  it("broadcasts shape update and delete to room members", async () => {
    const a = await connect("u1");
    await join(a, "room-edit");
    const b = await connect("u2");
    await join(b, "room-edit");

    const id = "rect-1";
    a.send({
      type: "shape_add",
      roomId: "room-edit",
      shape: { id, userId: "u1", type: "rect", x: 0, y: 0, width: 10, height: 10 },
    });
    await b.waitFor("shape_add");

    a.send({ type: "shape_update", roomId: "room-edit", shapeId: id, shape: { width: 20 } });
    const upd = await b.waitFor("shape_update");
    expect(upd.type).toBe("shape_update");
    if (upd.type === "shape_update") expect(upd.shape.width).toBe(20);

    a.send({ type: "shape_delete", roomId: "room-edit", shapeId: id });
    const del = await b.waitFor("shape_delete");
    expect(del.type).toBe("shape_delete");
    if (del.type === "shape_delete") expect(del.shapeId).toBe(id);
  });

  it("broadcasts bulk shape deletions to room members", async () => {
    const a = await connect("u1");
    await join(a, "room-bulk");
    const b = await connect("u2");
    await join(b, "room-bulk");

    a.send({
      type: "shape_add",
      roomId: "room-bulk",
      shape: { id: "r1", userId: "u1", type: "rect", x: 0, y: 0, width: 1, height: 1 },
    });
    a.send({
      type: "shape_add",
      roomId: "room-bulk",
      shape: { id: "r2", userId: "u1", type: "rect", x: 0, y: 0, width: 1, height: 1 },
    });
    await b.waitFor("shape_add");
    await b.waitFor("shape_add");

    a.send({ type: "shape_delete_many", roomId: "room-bulk", shapeIds: ["r1", "r2"] });
    const del = await b.waitFor("shape_delete_many");
    expect(del.type).toBe("shape_delete_many");
    if (del.type === "shape_delete_many") expect(del.shapeIds).toEqual(["r1", "r2"]);
  });

  it("enforces admin-only edit permission", async () => {
    ctx.mem.rooms.seed({ slug: "locked-room", adminId: "admin-u", editPermission: "admin" });

    const admin = await connect("admin-u");
    const { members } = await join(admin, "locked-room");
    expect(members).toContain("admin-u");

    const guest = await connect("guest-u");
    await join(guest, "locked-room");

    // Read-only guest tries to add a shape — must be silently ignored.
    guest.send({
      type: "shape_add",
      roomId: "locked-room",
      shape: { id: "forbidden", userId: "guest-u", type: "rect", x: 0, y: 0, width: 1, height: 1 },
    });
    await sleep(300);
    expect(admin.messages.some((m) => m.type === "shape_add")).toBe(false);

    // Admin adds a shape — the guest receives it.
    admin.send({
      type: "shape_add",
      roomId: "locked-room",
      shape: { id: "allowed", userId: "admin-u", type: "rect", x: 0, y: 0, width: 1, height: 1 },
    });
    const got = await guest.waitFor("shape_add");
    if (got.type === "shape_add") expect(got.shape.id).toBe("allowed");
  });
});

describe("WebSocket backend — chat", () => {
  it("broadcasts chat messages to room members", async () => {
    const a = await connect("u1");
    await join(a, "room-chat");
    const b = await connect("u2");
    await join(b, "room-chat");

    a.send({ type: "chat", roomId: "room-chat", message: "hello" });

    const msg = await b.waitFor("chat");
    expect(msg.type).toBe("chat");
    if (msg.type === "chat") {
      expect(msg.message).toBe("hello");
      expect(msg.userId).toBe("u1");
    }
  });
});