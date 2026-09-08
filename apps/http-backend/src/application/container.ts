import { UserRepository, RoomRepository, ChatRepository, ShapeRepository } from "./repositories";
import {
  TypeOrmUserRepository,
  TypeOrmRoomRepository,
  TypeOrmChatRepository,
  TypeOrmShapeRepository
} from "../infrastructure/repositories";

export interface Container {
  users: UserRepository;
  rooms: RoomRepository;
  chats: ChatRepository;
  shapes: ShapeRepository;
}

function createContainer(): Container {
  return {
    users: new TypeOrmUserRepository(),
    rooms: new TypeOrmRoomRepository(),
    chats: new TypeOrmChatRepository(),
    shapes: new TypeOrmShapeRepository()
  };
}

export const container: Container = createContainer();
