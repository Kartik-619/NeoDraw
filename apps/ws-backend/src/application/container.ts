import { RoomRepository, ChatRepository } from "./repositories";
import {
  TypeOrmRoomRepository,
  TypeOrmChatRepository
} from "../infrastructure/repositories";

export interface Container {
  rooms: RoomRepository;
  chats: ChatRepository;
}

function createContainer(): Container {
  return {
    rooms: new TypeOrmRoomRepository(),
    chats: new TypeOrmChatRepository()
  };
}

export const container: Container = createContainer();
