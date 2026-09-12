import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from "typeorm";

@Entity()
@Unique(["roomId", "userId"])
export class RoomMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  roomId!: number;

  @Column()
  userId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}