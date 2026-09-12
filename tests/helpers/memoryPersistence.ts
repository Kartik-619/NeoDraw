import type { Persistence, RoomStore, ShapeStore, ChatStore } from "@repo/http-backend/src/infrastructure/websocket/index";
import type { Room, RoomShape, Chat } from "@repo/db";
import type { EditPermission, PersistedShape } from "@repo/shared-types";

interface RoomRecord {
  id: number;
  slug: string;
  adminId: string | null;
  editPermission: EditPermission;
  createdAt: Date;
  updatedAt: Date;
}

interface ShapeRecord {
  id: string;
  roomId: number;
  userId: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatRecord {
  id: string;
  message: string;
  userId: string;
  roomId: number;
  createdAt: Date;
}

function asRoom(r: RoomRecord): Room {
  return r as Room;
}

function asShape(s: ShapeRecord): RoomShape {
  return s as RoomShape;
}

export class MemoryRoomStore implements RoomStore {
  private bySlug = new Map<string, RoomRecord>();
  private nextId = 1;

  async findOne({ where }: { where: { slug: string } }): Promise<Room | null> {
    const room = this.bySlug.get(where.slug);
    return room ? asRoom(room) : null;
  }

  create(data: { slug: string; adminId?: string }): Room {
    const record: RoomRecord = {
      id: this.nextId++,
      slug: data.slug,
      adminId: data.adminId ?? null,
      editPermission: "anyone",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.bySlug.set(record.slug, record);
    return asRoom(record);
  }

  async save(room: Room): Promise<Room> {
    const existing = Array.from(this.bySlug.values()).find((r) => r.id === room.id);
    if (existing) {
      existing.adminId = room.adminId;
      existing.editPermission = room.editPermission;
      existing.updatedAt = new Date();
      return asRoom(existing);
    }
    return room;
  }

  seed({ slug, adminId, editPermission }: { slug: string; adminId?: string; editPermission?: EditPermission }): Room {
    const existing = this.bySlug.get(slug);
    if (existing) {
      if (adminId !== undefined) existing.adminId = adminId;
      if (editPermission !== undefined) existing.editPermission = editPermission;
      return asRoom(existing);
    }
    const record: RoomRecord = {
      id: this.nextId++,
      slug,
      adminId: adminId ?? null,
      editPermission: editPermission ?? "anyone",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.bySlug.set(record.slug, record);
    return asRoom(record);
  }
}

export class MemoryShapeStore implements ShapeStore {
  private byId = new Map<string, ShapeRecord>();

  async find(opts: { where: { roomId: number }; order: { createdAt: "ASC" } }): Promise<RoomShape[]> {
    void opts.order;
    return Array.from(this.byId.values())
      .filter((s) => s.roomId === opts.where.roomId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(asShape);
  }

  async findOne(opts: { where: { id: string; roomId: number } }): Promise<RoomShape | null> {
    const shape = this.byId.get(opts.where.id);
    if (!shape || shape.roomId !== opts.where.roomId) return null;
    return asShape(shape);
  }

  create(data: { id: string; roomId: number; userId: string; data: Record<string, unknown> }): RoomShape {
    const record: ShapeRecord = {
      id: data.id,
      roomId: data.roomId,
      userId: data.userId,
      data: data.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.byId.set(record.id, record);
    return asShape(record);
  }

  async save(shape: RoomShape): Promise<RoomShape> {
    const existing = this.byId.get(shape.id);
    if (existing) {
      existing.data = shape.data;
      existing.updatedAt = new Date();
      return asShape(existing);
    }
    return shape;
  }

  async delete(criteria: { id?: string | string[]; roomId?: number }): Promise<unknown> {
    const ids = Array.isArray(criteria.id) ? criteria.id : criteria.id ? [criteria.id] : null;
    if (!ids) {
      for (const [id, shape] of this.byId) {
        if (criteria.roomId !== undefined && shape.roomId === criteria.roomId) this.byId.delete(id);
      }
      return { affected: 0 };
    }
    let affected = 0;
    for (const id of ids) {
      const shape = this.byId.get(id);
      if (shape && (criteria.roomId === undefined || shape.roomId === criteria.roomId)) {
        this.byId.delete(id);
        affected += 1;
      }
    }
    return { affected };
  }

  all(): PersistedShape[] {
    return Array.from(this.byId.values()).map((s) => ({ ...s.data, id: s.id, userId: s.userId }) as PersistedShape);
  }
}

export class MemoryChatStore implements ChatStore {
  private items = new Map<string, ChatRecord>();
  private nextId = 1;

  create(data: { message: string; userId: string; roomId: number }): Chat {
    const record: ChatRecord = {
      id: `chat-${data.roomId}-${this.nextId++}`,
      message: data.message,
      userId: data.userId,
      roomId: data.roomId,
      createdAt: new Date(),
    };
    this.items.set(record.id, record);
    return record as Chat;
  }

  async save(chat: Chat): Promise<Chat> {
    return chat;
  }
}

export interface MemoryPersistenceRef {
  persistence: Persistence;
  rooms: MemoryRoomStore;
  shapes: MemoryShapeStore;
  chats: MemoryChatStore;
}

export function createMemoryPersistence(): MemoryPersistenceRef {
  const rooms = new MemoryRoomStore();
  const shapes = new MemoryShapeStore();
  const chats = new MemoryChatStore();
  return { persistence: { rooms, shapes, chats }, rooms, shapes, chats };
}