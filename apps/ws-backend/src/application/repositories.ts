import { Room, Chat, RoomShape } from "@repo/db";
import { PersistedShape, Shape } from "@repo/shared-types";

export interface RoomRepository {
  findBySlug(slug: string): Promise<Room | null>;
  create(data: { slug: string; adminId?: string }): Promise<Room>;
}

export interface ChatRepository {
  create(data: { message: string; userId: string; roomId: number }): Promise<Chat>;
}

export interface ShapeRepository {
  findByRoomId(roomId: number): Promise<RoomShape[]>;
  findById(id: string): Promise<RoomShape | null>;
  create(data: { roomId: number; userId: string; shape: Shape; id?: string }): Promise<PersistedShape>;
  update(id: string, shape: Shape): Promise<PersistedShape | null>;
  remove(id: string): Promise<void>;
  removeMany(ids: string[]): Promise<number>;
}
