import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const CreateRoomSchema = z.object({
  name: z.string().min(1).optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type SignInInput = z.infer<typeof SignInSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
