import { User, Room, Chat } from "@repo/db";

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  create(data: { email: string; password: string; name: string }): Promise<User>;
}

export interface RoomRepository {
  findBySlug(slug: string): Promise<Room | null>;
  create(data: { slug: string; adminId?: string }): Promise<Room>;
}

export interface ChatRepository {
  findRecentByRoomId(roomId: number, take?: number): Promise<Chat[]>;
  create(data: { message: string; userId: string; roomId: number }): Promise<Chat>;
}
