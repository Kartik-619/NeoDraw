import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import { CreateUserSchema, CreateRoomSchema, SignInSchema } from "@repo/common/types";
import { db } from "@repo/db";
import cors from 'cors';


const app = express();
app.use(express.json());
app.use(cors());

app.post("/signup", async (req, res) => {
    const data = CreateUserSchema.safeParse(req.body);
    if (!data.success) {
        return res.status(400).json({
            message: "Invalid inputs"
        });
    }
    
    try {
        const userRepo = db.users();
        
        // Check if user already exists
        const existingUser = await userRepo.findOne({
            where: { email: data.data.email }
        });
        
        if (existingUser) {
            return res.status(409).json({
                message: "User already exists with this email"
            });
        }

        // Hash the password


        // Create new user
        const user = userRepo.create({
            email: data.data.email,
            password: data.data.password,
            name: data.data.name,
        });
        
        await userRepo.save(user);
        
        return res.status(201).json({
            userId: user.id
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

app.post("/signIn", async (req, res) => {
    const parsedData = SignInSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({
            message: "Incorrect inputs"
        });
    }

    try {
        const userRepo = db.users();
        
        const user = await userRepo.findOne({
            where: { email: parsedData.data.email }
        });

        if (!user) {
            return res.status(403).json({
                message: "Not authorized"
            });
        }
        const token = jwt.sign({
            userId: user.id
        }, JWT_SECRET);

        res.json({
            token
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
});

app.post("/room", middleware, async (req, res) => {
    const parsedData = CreateRoomSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({
            message: "Incorrect inputs"
        });
    }
    
    const userId = (req as any).userId;

    try {
        const roomRepo = db.rooms();
        
        // Check if room already exists
        const existingRoom = await roomRepo.findOne({
            where: { slug: parsedData.data.name }
        });
        
        if (existingRoom) {
            return res.status(411).json({
                message: "Room already exists with this name"
            });
        }

        // Create new room
        const room = roomRepo.create({
            slug: parsedData.data.name,
            adminId: userId
        });

        await roomRepo.save(room);

        res.json({
            roomId: room.id
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({
            message: "Internal server error"
        });
    }
});

app.get("/chats/:roomId", async (req, res) => {
    try {
        const roomId = Number(req.params.roomId);
        const chatRepo = db.chats();
        
        const messages = await chatRepo.find({
            where: { roomId },
            order: { createdAt: "DESC" },
            take: 50
        });
        
        res.json({
            messages
        });
    } catch (e) {
        console.error(e);
        res.json({
            messages: []
        });
    }
});

app.get("/room/:slug", async (req, res) => {
    try {
        const slug = req.params.slug;
        const roomRepo = db.rooms();
        
        const room = await roomRepo.findOne({
            where: { slug }
        });
        
        res.json({
            room
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({
            message: "Internal server error"
        });
    }
});

const PORT = 3008;
app.listen(PORT, () => {
    console.log(`✅ HTTP Backend running on port ${PORT}`);
});