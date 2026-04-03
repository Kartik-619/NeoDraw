// In packages/db/src/entities/Chat.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { Room } from "./Room";
import { User } from "./User";

@Entity()
export class Chat {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  message: string;

  @Column()
  userId: string;

  @Column() // Add this column
  roomId: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Room, (room) => room.chats)
  room: Room;

  @ManyToOne(() => User, (user) => user.chats)
  user: User;
}