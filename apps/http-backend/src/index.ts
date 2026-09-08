import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware, AuthenticatedRequest } from "./middleware";
import { CreateUserSchema, CreateRoomSchema, SignInSchema } from "@repo/common/types";
import { container } from "./application/container";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toPersistedShape } from "@repo/db";
import { isValidShape, Shape } from "@repo/shared-types";

const app = express();

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

// ✅ IMPORTANT FOR COOKIES
app.use(cors({
    origin: FRONTEND_ORIGIN,
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

/* =========================
   AUTH ROUTES
========================= */

app.post("/signup", async (req, res) => {
    const data = CreateUserSchema.safeParse(req.body);
    if (!data.success) {
        return res.status(400).json({ message: "Invalid inputs" });
    }

    const existingUser = await container.users.findByEmail(data.data.email);

    if (existingUser) {
        return res.status(409).json({ message: "User already exists" });
    }

    const user = await container.users.create({
        email: data.data.email,
        password: data.data.password,
        name: data.data.name
    });

    res.status(201).json({ userId: user.id });
});

app.post("/signIn", async (req, res) => {
    const parsedData = SignInSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Incorrect inputs" });
    }

    const user = await container.users.findByEmail(parsedData.data.email);

    if (!user || user.password !== parsedData.data.password) {
        return res.status(403).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET);

    // ✅ SET COOKIE (CORE FIX)
    res.cookie("token", token, {
        httpOnly: true,
        secure: false,          // true in production (HTTPS)
        sameSite: "none",       // 🔥 VERY IMPORTANT
        path: "/",
    });

    let defaultRoom = await container.rooms.findBySlug(`${user.id}-workspace`);

    if (!defaultRoom) {
        defaultRoom = await container.rooms.create({
            slug: `${user.id}-workspace`,
            adminId: user.id
        });
    }

    res.json({
        slug: defaultRoom.slug,
        token 
    });
});

/* =========================
   OLD ROUTES (COMPATIBILITY)
========================= */

app.post("/room", middleware, async (req: AuthenticatedRequest, res) => {
    const parsedData = CreateRoomSchema.safeParse(req.body);
    if (!parsedData.success) {
        return res.status(400).json({ message: "Incorrect inputs" });
    }

    const userId = req.userId;

    const existingRoom = await container.rooms.findBySlug(parsedData.data.name);

    if (existingRoom) {
        return res.status(411).json({ message: "Room already exists" });
    }

    const room = await container.rooms.create({
        slug: parsedData.data.name,
        adminId: userId
    });

    res.json({ roomId: room.id });
});

app.get("/chats/:roomId", async (req, res) => {
    try {
        const roomId = Number(req.params.roomId);

        const messages = await container.chats.findRecentByRoomId(roomId);

        res.json({ messages });
    } catch {
        res.json({ messages: [] });
    }
});

/* =========================
   NEW SLUG SYSTEM
========================= */

app.get("/room/:slug", async (req, res) => {
    try {
        const slug = String(req.params.slug);

        let room = await container.rooms.findBySlug(slug);

        if (!room) {
            room = await container.rooms.create({
                slug,
                adminId: undefined
            });
        }

        res.json({ room });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/rooms/:slug/chats", async (req, res) => {
    try {
        const slug = String(req.params.slug);

        const room = await container.rooms.findBySlug(slug);

        if (!room) {
            return res.json({ messages: [] });
        }

        const messages = await container.chats.findRecentByRoomId(room.id);

        res.json({ messages });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/rooms/:slug/chat", middleware, async (req: AuthenticatedRequest, res) => {
    try {
        const slug = String(req.params.slug);
        const { message } = req.body;
        const userId = req.userId;

        if (!message) {
            return res.status(400).json({ message: "Message required" });
        }

        const room = await container.rooms.findBySlug(slug);

        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }

        const chat = await container.chats.create({
            message,
            userId: userId!,
            roomId: room.id
        });

        res.json({
            success: true,
            chat
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
});

/* =========================
   SHAPE CRUD (first-class)
========================= */

async function resolveRoomBySlug(slug: string) {
    let room = await container.rooms.findBySlug(slug);

    if (!room) {
        room = await container.rooms.create({ slug, adminId: undefined });
    }

    return room;
}

app.get("/rooms/:slug/shapes", async (req, res) => {
    try {
        const slug = String(req.params.slug);
        const room = await resolveRoomBySlug(slug);

        const stored = await container.shapes.findByRoomId(room.id);

        res.json({ shapes: stored.map(toPersistedShape) });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/rooms/:slug/shapes", middleware, async (req: AuthenticatedRequest, res) => {
    try {
        const slug = String(req.params.slug);
        const { shape } = req.body;
        const userId = req.userId;

        if (!isValidShape(shape)) {
            return res.status(400).json({ message: "Invalid shape" });
        }

        const room = await resolveRoomBySlug(slug);

        const shapeWithId = shape as Shape & { id?: unknown };
        const persisted = await container.shapes.create({
            roomId: room.id,
            userId: userId!,
            shape,
            id: typeof shapeWithId.id === "string" ? shapeWithId.id : undefined
        });

        res.status(201).json({ shape: persisted });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.patch("/rooms/:slug/shapes/:shapeId", middleware, async (req: AuthenticatedRequest, res) => {
    try {
        const slug = String(req.params.slug);
        const shapeId = String(req.params.shapeId);
        const { shape } = req.body;

        if (!isValidShape(shape)) {
            return res.status(400).json({ message: "Invalid shape" });
        }

        const room = await resolveRoomBySlug(slug);
        const existing = await container.shapes.findById(shapeId);

        if (!existing || existing.roomId !== room.id) {
            return res.status(404).json({ message: "Shape not found" });
        }

        const updated = await container.shapes.update(shapeId, shape);

        res.json({ shape: updated });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.delete("/rooms/:slug/shapes/:shapeId", middleware, async (req: AuthenticatedRequest, res) => {
    try {
        const slug = String(req.params.slug);
        const shapeId = String(req.params.shapeId);

        const room = await resolveRoomBySlug(slug);
        const existing = await container.shapes.findById(shapeId);

        if (!existing || existing.roomId !== room.id) {
            return res.status(404).json({ message: "Shape not found" });
        }

        await container.shapes.remove(shapeId);

        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/rooms/:slug/shapes/delete-many", middleware, async (req: AuthenticatedRequest, res) => {
    try {
        const slug = String(req.params.slug);
        const { shapeIds } = req.body;

        if (!Array.isArray(shapeIds) || shapeIds.length === 0) {
            return res.status(400).json({ message: "shapeIds required" });
        }

        const room = await resolveRoomBySlug(slug);
        const removed = await container.shapes.removeMany(shapeIds.map(String));

        res.json({ success: true, removed });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Internal server error" });
    }
});

const PORT = 3008;
app.listen(PORT, () => {
    console.log(`✅ HTTP Backend running on port ${PORT}`);
});
