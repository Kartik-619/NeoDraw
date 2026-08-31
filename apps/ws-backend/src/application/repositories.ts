import { Room, Chat } from "@repo/db";

export interface RoomRepository {
  findBySlug(slug: string): Promise<Room | null>;
  create(data: { slug: string; adminId?: string }): Promise<Room>;
}

export interface ChatRepository {
  create(data: { message: string; userId: string; roomId: number }): Promise<Chat>;
}
