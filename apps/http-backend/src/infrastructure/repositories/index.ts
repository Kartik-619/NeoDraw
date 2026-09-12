import { In } from "typeorm";
import { initializeDatabase, db, toPersistedShape } from "@repo/db";
import type { PersistedShape, Shape, EditPermission } from "@repo/shared-types";
import type { UserRepository, RoomRepository, ShapeRepository, ChatRepository, MemberRepository, RoomRecord } from "../../application/repositories.js";
import type { Container } from "../../application/container.js";

class TypeOrmUserRepository implements UserRepository {
  async findById(id: string) {
    return await db.users().findOne({ where: { id } });
  }
  async findByEmail(email: string) {
    return await db.users().findOne({ where: { email } });
  }
  async create(data: { email: string; password: string; name: string }) {
    const user = db.users().create(data);
    const saved = await db.users().save(user);
    return { id: saved.id };
  }
}

class TypeOrmRoomRepository implements RoomRepository {
  async findById(id: number) {
    const room = await db.rooms().findOne({ where: { id } });
    return room ? this.toRecord(room) : null;
  }
  async findBySlug(slug: string) {
    const room = await db.rooms().findOne({ where: { slug } });
    return room ? this.toRecord(room) : null;
  }
  async findByAdminId(adminId: string): Promise<RoomRecord[]> {
    const rooms = await db.rooms().find({ where: { adminId }, order: { updatedAt: "DESC" } });
    return rooms.map((room) => this.toRecord(room));
  }
  async findAccessibleByUser(userId: string): Promise<RoomRecord[]> {
    const memberRows = await db.members().find({ where: { userId } });
    const memberRoomIds = memberRows.map((row) => row.roomId);
    const where = memberRoomIds.length > 0
      ? [{ adminId: userId }, { id: In(memberRoomIds) }]
      : [{ adminId: userId }];
    const rooms = await db.rooms().find({ where, order: { updatedAt: "DESC" } });
    return rooms.map((room) => this.toRecord(room));
  }
  async create(data: { slug: string; adminId?: string }) {
    const room = db.rooms().create({ slug: data.slug, adminId: data.adminId, editPermission: "anyone" });
    const saved = await db.rooms().save(room);
    return this.toRecord(saved);
  }
  async updateEditPermission(slug: string, editPermission: EditPermission): Promise<RoomRecord | null> {
    const room = await db.rooms().findOne({ where: { slug } });
    if (!room) return null;
    room.editPermission = editPermission;
    const saved = await db.rooms().save(room);
    return this.toRecord(saved);
  }
  private toRecord(room: { id: number; slug: string; adminId: string | null; editPermission: EditPermission }): RoomRecord {
    return { id: room.id, slug: room.slug, adminId: room.adminId, editPermission: room.editPermission };
  }
}

class TypeOrmShapeRepository implements ShapeRepository {
  async findByRoomId(roomId: number): Promise<PersistedShape[]> {
    const shapes = await db.shapes().find({ where: { roomId }, order: { createdAt: "ASC" } });
    return shapes.map(toPersistedShape);
  }
  async findShapeInRoom(roomId: number, shapeId: string): Promise<PersistedShape | null> {
    const shape = await db.shapes().findOne({ where: { id: shapeId, roomId } });
    if (!shape) return null;
    return toPersistedShape(shape);
  }
  async create(data: { roomId: number; userId: string; shape: PersistedShape }): Promise<PersistedShape> {
    const { id, ...rest } = data.shape;
    const entity = db.shapes().create({ id, roomId: data.roomId, userId: data.userId, data: rest as Record<string, unknown> });
    const saved = await db.shapes().save(entity);
    return toPersistedShape(saved);
  }
  async update(roomId: number, shapeId: string, shape: Partial<Shape>): Promise<PersistedShape | null> {
    const existing = await db.shapes().findOne({ where: { id: shapeId, roomId } });
    if (!existing) return null;
    existing.data = { ...existing.data, ...shape } as Record<string, unknown>;
    const saved = await db.shapes().save(existing);
    return toPersistedShape(saved);
  }
  async delete(roomId: number, shapeId: string): Promise<boolean> {
    const result = await db.shapes().delete({ id: shapeId, roomId });
    return (result.affected ?? 0) > 0;
  }
  async deleteMany(roomId: number, shapeIds: string[]): Promise<string[]> {
    if (shapeIds.length === 0) return [];
    await db.shapes().delete({ id: In(shapeIds), roomId });
    return shapeIds;
  }
}

class TypeOrmChatRepository implements ChatRepository {
  async findByRoomId(roomId: number) {
    return await db.chats().find({ where: { roomId }, order: { createdAt: "ASC" } });
  }
  async create(data: { message: string; userId: string; roomId: number }) {
    const chat = db.chats().create(data);
    await db.chats().save(chat);
  }
}

class TypeOrmMemberRepository implements MemberRepository {
  async add(roomId: number, userId: string): Promise<void> {
    const existing = await db.members().findOne({ where: { roomId, userId } });
    if (existing) return;
    const member = db.members().create({ roomId, userId });
    await db.members().save(member);
  }
  async remove(roomId: number, userId: string): Promise<void> {
    await db.members().delete({ roomId, userId });
  }
  async isMember(roomId: number, userId: string): Promise<boolean> {
    const found = await db.members().findOne({ where: { roomId, userId } });
    return found !== null;
  }
  async findUserIdsForRoom(roomId: number): Promise<string[]> {
    const rows = await db.members().find({ where: { roomId } });
    return rows.map((row) => row.userId);
  }
  async findEmailsForRoom(roomId: number): Promise<{ userId: string; email: string }[]> {
    const rows = await db.members().find({ where: { roomId } });
    if (rows.length === 0) return [];
    const users = await db.users().find({ where: { id: In(rows.map((row) => row.userId)) } });
    const emailById = new Map(users.map((u) => [u.id, u.email]));
    return rows.map((row) => ({ userId: row.userId, email: emailById.get(row.userId) ?? row.userId }));
  }
}

export async function buildTypeOrmContainer(): Promise<Container> {
  await initializeDatabase();
  return {
    users: new TypeOrmUserRepository(),
    rooms: new TypeOrmRoomRepository(),
    shapes: new TypeOrmShapeRepository(),
    chats: new TypeOrmChatRepository(),
    members: new TypeOrmMemberRepository(),
  };
}