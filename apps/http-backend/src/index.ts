import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { middleware } from "./middleware";
import { CreateUserSchema, CreateRoomSchema, SignInSchema } from "@repo/common/types";
import { prisma } from "@repo/db/client"

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
        await prisma.user.create({
            data:{
                email:data.data?.username,
                password:data.data.password,
                name:data.data.name,
            }
        })
        
        
        return res.json({
        userdId: '123'
        });
    }catch(e){

    }

})

app.post("/signIn", (req, res) => {
    const data = SignInSchema.safeParse(req.body);
    if (!data.success) {
        return res.json({
            message: "invalid inputs"
        });
    }
    const userId = 1;
    const token = jwt.sign({
        userId
    }, JWT_SECRET);

    res.json({ token });

})

app.post("/room", (req, res) => {
    //dbcall
    const data = CreateRoomSchema.safeParse(req.body);
    if (!data.success) {
        return res.json({
            message: "invalid inputs"
        });
    }
    res.json({
        roomId: 123
    })
})

app.listen(3008);