import { describe, it, expect, beforeAll } from "vitest";
import type { User, Room, Chat, RoomShape } from "@repo/db";
import type { UserRepository, RoomRepository, ChatRepository, ShapeRepository } from "../../../apps/http-backend/src/application/repositories";
import type { PersistedShape, Shape } from "@repo/shared-types";
import { randId } from "./randId";

// In-memory repositories so integration tests run without a real PostgreSQL instance.
export class InMemoryUserRepository implements UserRepository {
  private users: User[] = [];

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async create(data: { email: string; password: string; name: string }): Promise<User> {
    const user = {
      id: "user-" + (this.users.length + 1),
      email: data.email,
      password: data.password,
      name: data.name,
      createdAt: new Date(),
      updatedAt: new Date(),
      rooms: [],
      chats: [],
      shapes: []
    } as unknown as User;
    this.users.push(user);
    return user;
  }
}

export class InMemoryRoomRepository implements RoomRepository {
  private rooms: Room[] = [];

  async findBySlug(slug: string): Promise<Room | null> {
    return this.rooms.find((r) => r.slug === slug) ?? null;
  }

  async create(data: { slug: string; adminId?: string }): Promise<Room> {
    const room = {
      id: this.rooms.length + 1,
      slug: data.slug,
      adminId: data.adminId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      admin: null,
      chats: [],
      shapes: []
    } as unknown as Room;
    this.rooms.push(room);
    return room;
  }
}

export class InMemoryChatRepository implements ChatRepository {
  private chats: Chat[] = [];

  async findRecentByRoomId(roomId: number, take = 50): Promise<Chat[]> {
    return this.chats
      .filter((c) => c.roomId === roomId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, take);
  }

  async create(data: { message: string; userId: string; roomId: number }): Promise<Chat> {
    const chat = {
      id: "chat-" + (this.chats.length + 1),
      message: data.message,
      userId: data.userId,
      roomId: data.roomId,
      createdAt: new Date(),
      room: null,
      user: null
    } as unknown as Chat;
    this.chats.push(chat);
    return chat;
  }

  all(): Chat[] {
    return this.chats;
  }
}

export class InMemoryShapeRepository implements ShapeRepository {
  private shapes: RoomShape[] = [];

  private toPersisted(s: RoomShape): PersistedShape {
    return {
      ...(s.data as Shape),
      id: s.id,
      userId: s.userId
    };
  }

  async findByRoomId(roomId: number): Promise<RoomShape[]> {
    return this.shapes.filter((s) => s.roomId === roomId);
  }

  async findById(id: string): Promise<RoomShape | null> {
    return this.shapes.find((s) => s.id === id) ?? null;
  }

  async create(data: { roomId: number; userId: string; shape: Shape; id?: string }): Promise<PersistedShape> {
    const entity = {
      id: data.id ?? randId(),
      roomId: data.roomId,
      userId: data.userId,
      data: data.shape,
      createdAt: new Date(),
      updatedAt: new Date(),
      room: null,
      user: null
    } as unknown as RoomShape;
    this.shapes.push(entity);
    return this.toPersisted(entity);
  }

  async update(id: string, shape: Shape): Promise<PersistedShape | null> {
    const existing = this.shapes.find((s) => s.id === id);
    if (!existing) return null;
    existing.data = shape;
    return this.toPersisted(existing);
  }

  async remove(id: string): Promise<void> {
    this.shapes = this.shapes.filter((s) => s.id !== id);
  }

  async removeMany(ids: string[]): Promise<number> {
    const before = this.shapes.length;
    this.shapes = this.shapes.filter((s) => !ids.includes(s.id));
    return before - this.shapes.length;
  }

  all(): RoomShape[] {
    return this.shapes;
  }
}

export function createMemoryContainer() {
  return {
    users: new InMemoryUserRepository(),
    rooms: new InMemoryRoomRepository(),
    chats: new InMemoryChatRepository(),
    shapes: new InMemoryShapeRepository()
  };
}

export type MemoryContainer = ReturnType<typeof createMemoryContainer>;
