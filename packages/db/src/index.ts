import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Room } from "./entities/Room";
import { Chat } from "./entities/Chat";
import { RoomShape } from "./entities/RoomShape";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: true,
  logging: false,
  entities: [User, Room, Chat, RoomShape],
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

export const db = { users, rooms, chats, shapes };

export type { User } from "./entities/User";
export type { Room } from "./entities/Room";
export type { Chat } from "./entities/Chat";
export type { RoomShape } from "./entities/RoomShape";
export { toRoomInfo } from "./entities/Room";
export { toPersistedShape } from "./shape-mapper";
