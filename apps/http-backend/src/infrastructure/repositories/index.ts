import { db, User, Room, Chat, RoomShape } from "@repo/db";
import { toPersistedShape } from "@repo/db";
import { Shape, PersistedShape } from "@repo/shared-types";
import { UserRepository, RoomRepository, ChatRepository, ShapeRepository } from "../../application/repositories";

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

export class TypeOrmShapeRepository implements ShapeRepository {
  async findByRoomId(roomId: number): Promise<RoomShape[]> {
    return db.shapes().find({
      where: { roomId },
      order: { createdAt: "ASC" }
    });
  }

  async findById(id: string): Promise<RoomShape | null> {
    return db.shapes().findOne({ where: { id } });
  }

  async create(data: { roomId: number; userId: string; shape: Shape; id?: string }): Promise<PersistedShape> {
    const entity = db.shapes().create({
      id: data.id ?? undefined,
      roomId: data.roomId,
      userId: data.userId,
      data: data.shape as unknown as object
    });
    const saved = await db.shapes().save(entity);
    return toPersistedShape(saved);
  }

  async update(id: string, shape: Shape): Promise<PersistedShape | null> {
    const existing = await db.shapes().findOne({ where: { id } });
    if (!existing) return null;
    existing.data = shape as unknown as object;
    const saved = await db.shapes().save(existing);
    return toPersistedShape(saved);
  }

  async remove(id: string): Promise<void> {
    await db.shapes().delete({ id });
  }

  async removeMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await db.shapes().delete(ids);
    return result.affected ?? 0;
  }
}
