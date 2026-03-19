import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import { CreateUserSchema, CreateRoomSchema, SignInSchema } from "@repo/common/types";
import { prisma } from "@repo/db/client";
const app = express();
app.use(express.json());

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
                email:data.data?.username,
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
    const data = SignInSchema.safeParse(req.body);
    if (!data.success) {
        return res.json({
            message: "invalid inputs"
        });
    }

    const user=await prisma.user.findFirst({
        where:{
            email:data.data?.username,
            password:data.data.password
        }
    })
    
    if(!user){
        return res.status(403).json({message:'The User does not exists'});
    }
    const token = jwt.sign({
        userId:user?.id
    }, JWT_SECRET);

    res.json({ token });

})

app.post("/room",async (req, res) => {
    //dbcall
    const data = CreateRoomSchema.safeParse(req.body);
    if (!data.success) {
        return res.json({
            message: "invalid inputs"
        });
    }
    const userId=req.body.userId;
    await prisma.room.create({
        data:{
            slug:data.data.name,
            adminId:userId
        }
    })
    res.json({
        roomId: 123
    })
})

app.get("/chats/:roomId", async (req,res)=>{
    const roomId=Number(req.params.roomId);
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
    })
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