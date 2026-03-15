import express from "express";
import  jwt  from "jsonwebtoken";
import { JWT_SECRET } from "./config";


const app=express();
app.use(express.json());

app.post("/signup",(req,res)=>{
//dbcall

})

app.post("/signIn",(req,res)=>{
    const userId=1;
    const token= jwt.sign({
        userId
    },JWT_SECRET);

    res.json({token});
    
})

app.post("/room",(req,res)=>{
    //dbcall
    
    res.json({
        roomId:123
    })
})

app.listen(3008);