import { WebSocketServer, WebSocket } from "ws";
import jwt, { decode, JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from '@repo/backend-common/config';
import { prisma } from "@repo/db/client";

const wss = new WebSocketServer({ port: 8080 });


interface User {
    ws: WebSocket,
    rooms: string[],
    userId: string
}

const users: User[] = [];

function CheckUser(token: string): string | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (typeof decoded == "string") {
            return null;
        }

        if (!decoded || !decoded.userId) {
            return null;
        }

        return decoded.userId;
    } catch (e) {
        return null;
    }

}

wss.on('connection', function connection(ws, req) {
    const url = req.url;
    if (!url) {
        return;
    }
    const queryParams = new URLSearchParams(url.split('?')[1]);
    const token = queryParams.get('token') || '';
    const userId = CheckUser(token);
    if (userId == null) {
        ws.close();
        return;
    }

    users.push({
        userId,
        rooms: [],
        ws
    })

    ws.on('message', async function message(data) {
        try {
            const parsedData = JSON.parse(data.toString()); //types->'join-room',roomId:1
            if (parsedData.type === "join_room") {
                const user = users.find(x => x.ws === ws);
                user?.rooms.push(parsedData.roomId);
            }

            if (parsedData.type === 'leave_room') {
                const user = users.find(x => x.ws === ws);
                if (!user) {
                    return;
                }
                user.rooms = user?.rooms.filter(x => x === parsedData.room);
            }
            if (parsedData.type === 'chat') {
                const roomId = parsedData.roomId;
                const msg = parsedData.message;

                //push the message in a queue then to a DB rather than pushing directly in db to prevent slow speed
                await prisma.chat.create({
                    data: {
                        roomId,
                        msg,
                        userId
                    }
                })


                users.forEach(user => {
                    if (user.rooms.includes(roomId)) {
                        user.ws.send(JSON.stringify({
                            type: 'chat',
                            message: msg,
                            roomId
                        }))
                    }
                })
            }
        } catch (e) {

        }

    });
})