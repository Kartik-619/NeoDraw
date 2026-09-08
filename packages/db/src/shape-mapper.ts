import type { PersistedShape } from "@repo/shared-types";
import type { RoomShape } from "./entities/RoomShape";

export function toPersistedShape(shape: RoomShape): PersistedShape {
  return { ...(shape.data as Record<string, unknown>), id: shape.id, userId: shape.userId } as PersistedShape;
}
