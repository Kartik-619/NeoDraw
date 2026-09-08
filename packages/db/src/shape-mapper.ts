import { PersistedShape, Shape } from "@repo/shared-types";
import { RoomShape } from "./entities/RoomShape";

export function toPersistedShape(shape: RoomShape): PersistedShape {
  const data = (shape.data ?? {}) as Shape;
  return {
    ...data,
    id: shape.id,
    userId: shape.userId,
  };
}