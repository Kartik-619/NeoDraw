import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import { CreateUserSchema, CreateRoomSchema, SignInSchema } from "@repo/common/types";
import { db } from "@repo/db";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

/* =========================
   AUTH ROUTES
========================= */

app.post("/signup", async (req, res) => {
    const data = CreateUserSchema.safeParse(req.body);
    if (!data.success) {
        return res.status(400).json({ message: "Invalid inputs" });
    }

    const userRepo = db.users();

    const existingUser = await userRepo.findOne({
        where: { email: data.data.email }
    });

    if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
    }

    const user = userRepo.create({
        email: data.data.email,
        password: data.data.password,
        name: data.data.name
    });

    await userRepo.save(user);

    res.status(201).json({ userId: user.id });
});

app.post("/signIn", async (req, res) => {
    const parsedData = SignInSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Incorrect inputs" });
    }

    const user = await db.users().findOne({
        where: { email: parsedData.data.email }
    });

    if (!user) {
        return res.status(403).json({ message: "Not authorized" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);

    res.json({ token });
});

/* =========================
   OLD ROUTES (COMPATIBILITY)
========================= */

app.post("/room", middleware, async (req, res) => {
    const parsedData = CreateRoomSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Incorrect inputs" });
    }

    const userId = (req as any).userId;

    const existingRoom = await db.rooms().findOne({
        where: { slug: parsedData.data.name }
    });

    if (existingRoom) {
        return res.status(411).json({ message: "Room already exists" });
    }

    const room = db.rooms().create({
        slug: parsedData.data.name,
        adminId: userId
    });

    await db.rooms().save(room);

    res.json({ roomId: room.id });
});

// ✅ FIXED - Use roomId column directly
app.get("/chats/:roomId", async (req, res) => {
    try {
        const roomId = Number(req.params.roomId);

        const messages = await db.chats().find({
            where: {
                roomId: roomId // ✅ Use direct column
            },
            order: { createdAt: "DESC" },
            take: 50
        });

        res.json({ messages });
    } catch {
        res.json({ messages: [] });
    }
});

/* =========================
   NEW SLUG SYSTEM
========================= */

// ✅ get or create room
app.get("/room/:slug", async (req, res) => {
    try {
        const slug = String(req.params.slug);

        let room = await db.rooms().findOne({
            where: { slug }
        });

        if (!room) {
            room = db.rooms().create({
                slug,
                adminId: undefined
            });

            await db.rooms().save(room);
        }

        res.json({ room });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ✅ get chats by slug - FIXED
app.get("/rooms/:slug/chats", async (req, res) => {
    try {
        const slug = String(req.params.slug);

        const room = await db.rooms().findOne({
            where: { slug }
        });

        if (!room) {
            return res.json({ messages: [] });
        }

        const messages = await db.chats().find({
            where: {
                roomId: room.id // ✅ Use direct column
            },
            order: { createdAt: "DESC" },
            take: 50
        });

        res.json({ messages });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ✅ send chat - FIXED
app.post("/rooms/:slug/chat", middleware, async (req, res) => {
    try {
        const slug = String(req.params.slug);
        const { message } = req.body;
        const userId = (req as any).userId;

        if (!message) {
            return res.status(400).json({ message: "Message required" });
        }

        const room = await db.rooms().findOne({
            where: { slug }
        });

        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }

        const chat = db.chats().create({
            message,
            userId,
            roomId: room.id // ✅ Use direct column
        });

        await db.chats().save(chat);

        res.json({
            success: true,
            chat
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
});

const PORT = 3008;
app.listen(PORT, () => {
    console.log(`✅ HTTP Backend running on port ${PORT}`);
});