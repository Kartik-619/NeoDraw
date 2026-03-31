import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { User } from "./entities/User";
import { Room } from "./entities/Room";
import { Chat } from "./entities/Chat";

let initialized = false;

// Auto-initialize when imported
export const initializeDatabase = async () => {
  if (!initialized && !AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    initialized = true;
    console.log("✅ Database connected and tables synced!");
  }
  return AppDataSource;
};

// Call initialization immediately
initializeDatabase().catch(console.error);

// Export repositories for easy access
export const db = {
  users: () => AppDataSource.getRepository(User),
  rooms: () => AppDataSource.getRepository(Room),
  chats: () => AppDataSource.getRepository(Chat),
};


export { AppDataSource } from "./data-source";