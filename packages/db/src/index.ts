import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Room } from "./entities/Room";
import { Chat } from "./entities/Chat";
import { RoomShape } from "./entities/RoomShape";
import { RoomMember } from "./entities/RoomMember";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and configure your PostgreSQL connection URL.",
  );
}

export const AppDataSource = new DataSource({
  type: "postgres",
  url: databaseUrl,
  synchronize: true,
  logging: false,
  entities: [User, Room, Chat, RoomShape, RoomMember],
});

let initialized = false;

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;
  await AppDataSource.initialize();
  initialized = true;
}

function users() {
  return AppDataSource.getRepository(User);
}

function rooms() {
  return AppDataSource.getRepository(Room);
}

function chats() {
  return AppDataSource.getRepository(Chat);
}

function shapes() {
  return AppDataSource.getRepository(RoomShape);
}

function members() {
  return AppDataSource.getRepository(RoomMember);
}

export const db = { users, rooms, chats, shapes, members };

export type { User } from "./entities/User";
export type { Room } from "./entities/Room";
export type { Chat } from "./entities/Chat";
export type { RoomShape } from "./entities/RoomShape";
export type { RoomMember } from "./entities/RoomMember";
export { toRoomInfo } from "./entities/Room";
export { toPersistedShape } from "./shape-mapper";
