import { UserRepository, RoomRepository, ChatRepository } from "./repositories";
import {
  TypeOrmUserRepository,
  TypeOrmRoomRepository,
  TypeOrmChatRepository
} from "../infrastructure/repositories";

export interface Container {
  users: UserRepository;
  rooms: RoomRepository;
  chats: ChatRepository;
}

function createContainer(): Container {
  return {
    users: new TypeOrmUserRepository(),
    rooms: new TypeOrmRoomRepository(),
    chats: new TypeOrmChatRepository()
  };
}

export const container: Container = createContainer();
