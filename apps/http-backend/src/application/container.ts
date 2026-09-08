import type { UserRepository, RoomRepository, ShapeRepository, ChatRepository } from "./repositories";

export interface Container {
  users: UserRepository;
  rooms: RoomRepository;
  shapes: ShapeRepository;
  chats: ChatRepository;
}

let container: Container | null = null;

export function setContainer(c: Container): void {
  container = c;
}

export function getContainer(): Promise<Container> {
  if (container) return Promise.resolve(container);

  // Lazy-load the TypeORM adapter only when the app actually boots.
  // Tests inject a memory container via setContainer and never trigger this.
  return import("../infrastructure/repositories/index").then((m) => {
    if (container) return container;
    return m.buildTypeOrmContainer();
  });
}