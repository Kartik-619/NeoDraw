import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";

@Entity()
export class Chat {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  message!: string;

  @Column({ nullable: true })
  userId!: string;

  @Column({ nullable: true })
  roomId!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
