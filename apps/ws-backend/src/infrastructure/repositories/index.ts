import { db, Room, Chat } from "@repo/db";
import { RoomRepository, ChatRepository } from "../../application/repositories";

export class TypeOrmRoomRepository implements RoomRepository {
  async findBySlug(slug: string): Promise<Room | null> {
    return db.rooms().findOne({ where: { slug } });
  }

  async create(data: { slug: string; adminId?: string }): Promise<Room> {
    const room = db.rooms().create(data);
    return db.rooms().save(room);
  }
}

export class TypeOrmChatRepository implements ChatRepository {
  async create(data: { message: string; userId: string; roomId: number }): Promise<Chat> {
    const chat = db.chats().create(data);
    return db.chats().save(chat);
  }
}
