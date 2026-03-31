import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./User";
import { Chat } from "./Chat";

@Entity()
export class Room {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  slug: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  adminId: string;

  @ManyToOne(() => User, (user) => user.rooms)
  admin: User;

  @OneToMany(() => Chat, (chat) => chat.room)
  chats: Chat[];
}