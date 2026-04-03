import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entities/User";
import { Room } from "./entities/Room";
import { Chat } from "./entities/Chat";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: true, // Auto-creates tables (like Prisma db push)
  logging: false, // See SQL queries in console
  entities: [User, Room, Chat],
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});