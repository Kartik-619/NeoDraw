import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import type { EditPermission, RoomInfo } from "@repo/shared-types";

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  slug!: string;

  @Column({ nullable: true })
  adminId!: string;

  @Column({ type: "varchar", default: "anyone" })
  editPermission: EditPermission = "anyone";

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

export function toRoomInfo(room: Room): RoomInfo {
  return {
    id: room.id,
    slug: room.slug,
    adminId: room.adminId,
    editPermission: room.editPermission,
  };
}
