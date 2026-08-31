import { db, User, Room, Chat } from "@repo/db";
import { UserRepository, RoomRepository, ChatRepository } from "../../application/repositories";

export class TypeOrmUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return db.users().findOne({ where: { email } });
  }

  async create(data: { email: string; password: string; name: string }): Promise<User> {
    const user = db.users().create(data);
    return db.users().save(user);
  }
}

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
  async findRecentByRoomId(roomId: number, take = 50): Promise<Chat[]> {
    return db.chats().find({
      where: { roomId },
      order: { createdAt: "DESC" },
      take
    });
  }

  async create(data: { message: string; userId: string; roomId: number }): Promise<Chat> {
    const chat = db.chats().create(data);
    return db.chats().save(chat);
  }
}
