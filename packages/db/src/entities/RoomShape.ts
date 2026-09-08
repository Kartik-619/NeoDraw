import "reflect-metadata";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class RoomShape {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  roomId!: number;

  @Column()
  userId!: string;

  @Column({ type: "jsonb" })
  data!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
