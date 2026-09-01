import { describe, it, expect, beforeAll } from "vitest";
import type { User, Room, Chat } from "@repo/db";
import type { UserRepository, RoomRepository, ChatRepository } from "../../../apps/http-backend/src/application/repositories";

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
      chats: []
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
      chats: []
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

export function createMemoryContainer() {
  return {
    users: new InMemoryUserRepository(),
    rooms: new InMemoryRoomRepository(),
    chats: new InMemoryChatRepository()
  };
}

export type MemoryContainer = ReturnType<typeof createMemoryContainer>;
