import { RoomRepository, ChatRepository, ShapeRepository } from "./repositories";
import {
  TypeOrmRoomRepository,
  TypeOrmChatRepository,
  TypeOrmShapeRepository
} from "../infrastructure/repositories";

export interface Container {
  rooms: RoomRepository;
  chats: ChatRepository;
  shapes: ShapeRepository;
}

function createContainer(): Container {
  return {
    rooms: new TypeOrmRoomRepository(),
    chats: new TypeOrmChatRepository(),
    shapes: new TypeOrmShapeRepository()
  };
}

export const container: Container = createContainer();
