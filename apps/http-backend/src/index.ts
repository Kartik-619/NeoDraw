import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import { CreateUserSchema, CreateRoomSchema, SignInSchema } from "@repo/common/types";
import { prisma } from "@repo/db/client";
import cors from 'cors'
const app = express();
app.use(express.json());
app.use(cors());

app.post("/signup", async(req, res) => {
    //dbcall
    const data = CreateUserSchema.safeParse(req.body);
    if (!data.success) {
        return res.json({
            message: "invalid inputs"
        });
    }
    try{   
      const user=  await prisma.user.create({
            data:{
                email:data.data?.email,
                password:data.data.password,
                name:data.data.name,
            }
        })
        
        
        return res.json({
        userdId:user.id
        });
    }catch(e){
        return res.status(411).json({
                message:"User already exists with this username"
            }
        )
    }

})

app.post("/signIn", async(req, res) => {
    const parsedData = SignInSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.json({
            message: "Incorrect inputs"
        })
        return;
    }

    // TODO: Compare the hashed pws here
    const user = await prisma.user.findFirst({
        where: {
            email: parsedData.data.email,
            password: parsedData.data.password
        }
    })

    if (!user) {
        res.status(403).json({
            message: "Not authorized"
        })
        return;
    }

    const token = jwt.sign({
        userId: user?.id
    }, JWT_SECRET);

    res.json({
        token
    })

})

app.post("/room", middleware, async (req, res) => {
    const parsedData = CreateRoomSchema.safeParse(req.body);
    if (!parsedData.success) {
        res.json({
            message: "Incorrect inputs"
        })
        return;
    }
    // @ts-ignore: TODO: Fix this
    const userId = req.userId;

    try {
        const room = await prisma.room.create({
            data: {
                slug: parsedData.data.name,
                adminId: userId
            }
        })

        res.json({
            roomId: room.id
        })
    } catch(e) {
        res.status(411).json({
            message: "Room already exists with this name"
        })
    }
})

app.get("/chats/:roomId", async (req,res)=>{
    try{const roomId=Number(req.params.roomId);
    const message=await prisma.chat.findMany({
        where:{
            roomId:roomId
        },
        orderBy:{
            id:"desc"
        },
        take:50
    });
    res.json({
        message
    })}catch(e){
        console.log(e);
        res.json({
            messages: []
        })
    }
});
app.get("/room/:slug", async (req,res)=>{
    const slug=Number(req.params.slug);
    const room=await prisma.rooms.findFirst({
        where:{
            slug
        },
        
    });
    res.json({
       slug
    })
})
app.listen(3008);