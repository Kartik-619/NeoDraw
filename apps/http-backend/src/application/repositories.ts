import type { PersistedShape, Shape, EditPermission } from "@repo/shared-types";

export interface UserRepository {
  findById(id: string): Promise<{ id: string; email: string; name: string; password: string } | null>;
  findByEmail(email: string): Promise<{ id: string; email: string; name: string; password: string } | null>;
  create(data: { email: string; password: string; name: string }): Promise<{ id: string }>;
}

export interface RoomRecord {
  id: number;
  slug: string;
  adminId: string | null;
  editPermission: EditPermission;
}

export interface RoomRepository {
  findById(id: number): Promise<RoomRecord | null>;
  findBySlug(slug: string): Promise<RoomRecord | null>;
  findByAdminId(adminId: string): Promise<RoomRecord[]>;
  findAccessibleByUser(userId: string): Promise<RoomRecord[]>;
  create(data: { slug: string; adminId?: string }): Promise<RoomRecord>;
  updateEditPermission(slug: string, editPermission: EditPermission): Promise<RoomRecord | null>;
}

export interface RoomMemberRecord {
  roomId: number;
  userId: string;
}

export interface MemberRepository {
  add(roomId: number, userId: string): Promise<void>;
  remove(roomId: number, userId: string): Promise<void>;
  isMember(roomId: number, userId: string): Promise<boolean>;
  findUserIdsForRoom(roomId: number): Promise<string[]>;
  findEmailsForRoom(roomId: number): Promise<{ userId: string; email: string }[]>;
}

export interface ShapeRepository {
  findByRoomId(roomId: number): Promise<PersistedShape[]>;
  findShapeInRoom(roomId: number, shapeId: string): Promise<PersistedShape | null>;
  create(data: { roomId: number; userId: string; shape: PersistedShape }): Promise<PersistedShape>;
  update(roomId: number, shapeId: string, shape: Partial<Shape>): Promise<PersistedShape | null>;
  delete(roomId: number, shapeId: string): Promise<boolean>;
  deleteMany(roomId: number, shapeIds: string[]): Promise<string[]>;
}

export interface ChatRepository {
  findByRoomId(roomId: number): Promise<{ id: string; message: string; userId: string; roomId: number; createdAt: Date }[]>;
  create(data: { message: string; userId: string; roomId: number }): Promise<void>;
}
