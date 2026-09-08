import type { PersistedShape, Shape, EditPermission } from "@repo/shared-types";
import type { UserRepository, RoomRepository, ShapeRepository, ChatRepository } from "@repo/http-backend/src/application/repositories";
import { setContainer, type Container } from "@repo/http-backend/src/application/container";

interface TestUser {
  id: string;
  email: string;
  name: string;
  password: string;
}

interface TestRoom {
  id: number;
  slug: string;
  adminId: string | null;
  editPermission: EditPermission;
}

interface TestChat {
  id: string;
  message: string;
  userId: string;
  roomId: number;
  createdAt: Date;
}

class MemoryUserRepository implements UserRepository {
  private users: Map<string, TestUser> = new Map();
  private nextId = 1;

  async findById(id: string) {
    return this.users.get(id) || null;
  }
  async findByEmail(email: string) {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }
  async create(data: { email: string; password: string; name: string }) {
    const id = `user-${this.nextId++}`;
    this.users.set(id, { id, ...data });
    return { id };
  }
}

class MemoryRoomRepository implements RoomRepository {
  private rooms: Map<number, TestRoom> = new Map();
  private roomsBySlug: Map<string, TestRoom> = new Map();
  private nextId = 1;

  async findById(id: number) {
    return this.rooms.get(id) || null;
  }
  async findBySlug(slug: string) {
    return this.roomsBySlug.get(slug) || null;
  }
  async create(data: { slug: string; adminId?: string }) {
    const id = this.nextId++;
    const room: TestRoom = { id, slug: data.slug, adminId: data.adminId || null, editPermission: "anyone" };
    this.rooms.set(id, room);
    this.roomsBySlug.set(data.slug, room);
    return { id, slug: data.slug, adminId: room.adminId, editPermission: room.editPermission };
  }
  async updateEditPermission(slug: string, editPermission: EditPermission) {
    const room = this.roomsBySlug.get(slug);
    if (!room) return null;
    room.editPermission = editPermission;
    return room;
  }
}

class MemoryShapeRepository implements ShapeRepository {
  private shapes: Map<string, { roomId: number; shape: PersistedShape }> = new Map();

  async findByRoomId(roomId: number): Promise<PersistedShape[]> {
    return [...this.shapes.values()]
      .filter((s) => s.roomId === roomId)
      .map((s) => s.shape);
  }
  async findShapeInRoom(roomId: number, shapeId: string): Promise<PersistedShape | null> {
    const entry = this.shapes.get(shapeId);
    if (!entry || entry.roomId !== roomId) return null;
    return entry.shape;
  }
  async create(data: { roomId: number; userId: string; shape: PersistedShape }): Promise<PersistedShape> {
    this.shapes.set(data.shape.id, { roomId: data.roomId, shape: data.shape });
    return data.shape;
  }
  async update(roomId: number, shapeId: string, shape: Partial<Shape>): Promise<PersistedShape | null> {
    const entry = this.shapes.get(shapeId);
    if (!entry || entry.roomId !== roomId) return null;
    const updated = { ...entry.shape, ...shape } as PersistedShape;
    this.shapes.set(shapeId, { roomId, shape: updated });
    return updated;
  }
  async delete(roomId: number, shapeId: string): Promise<boolean> {
    const entry = this.shapes.get(shapeId);
    if (!entry || entry.roomId !== roomId) return false;
    this.shapes.delete(shapeId);
    return true;
  }
  async deleteMany(roomId: number, shapeIds: string[]): Promise<string[]> {
    const removed: string[] = [];
    for (const id of shapeIds) {
      const entry = this.shapes.get(id);
      if (entry && entry.roomId === roomId) {
        this.shapes.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }
}

class MemoryChatRepository implements ChatRepository {
  private chats: TestChat[] = [];
  private nextId = 1;

  async findByRoomId(roomId: number) {
    return this.chats.filter((c) => c.roomId === roomId);
  }
  async create(data: { message: string; userId: string; roomId: number }) {
    this.chats.push({
      id: `chat-${this.nextId++}`,
      ...data,
      createdAt: new Date(),
    });
  }
}

export function createMemoryContainer(): Container {
  return {
    users: new MemoryUserRepository(),
    rooms: new MemoryRoomRepository(),
    shapes: new MemoryShapeRepository(),
    chats: new MemoryChatRepository(),
  };
}

export function setupTestContainer(): Container {
  const container = createMemoryContainer();
  setContainer(container);
  return container;
}
