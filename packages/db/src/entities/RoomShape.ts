import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Room } from "./Room";
import { User } from "./User";

// A first-class persisted shape (rect, circle, pencil, diamond or text).
// Coordinates and type-specific properties are stored as structured JSON in the
// `data` column so the schema stays extensible without migrations per shape type.
@Entity()
export class RoomShape {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  roomId: number;

  @Column()
  userId: string;

  @Column({ type: "jsonb" })
  data: unknown;

  @ManyToOne(() => Room, (room) => room.shapes)
  @JoinColumn({ name: "roomId" })
  room: Room;

  @ManyToOne(() => User, (user) => user.shapes)
  @JoinColumn({ name: "userId" })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
