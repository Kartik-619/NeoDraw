import {z} from "zod";

export const CreateUserSchema=z.object({
    username:z.string().min(3).max(16),
    password:z.string().min(8),
    name:z.string()
});

export const SignInSchema=z.object({ 
name:z.string().min(3).max(16),
password: z.string().min(8)
});

export const CreateRoomSchema=z.object({
    name :z.string().min(3).max(20)
})