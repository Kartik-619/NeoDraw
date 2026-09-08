import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";

@Entity()
export class Chat {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  message!: string;

  @Column()
  userId!: string;

  @Column()
  roomId!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
