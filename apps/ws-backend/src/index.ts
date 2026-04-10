import { WebSocket, WebSocketServer } from 'ws';
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from '@repo/backend-common/config';
import { db } from "@repo/db";

const wss = new WebSocketServer({ port: 8080 });

// Add error handler for the server itself
wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
});

wss.on('listening', () => {
    console.log(`✅ WebSocket server running on port 8080`);
});

interface User {
  ws: WebSocket,
  rooms: string[],
  userId: string
}

const users: User[] = [];

function checkUser(token: string): string | null {
  try {
    if (!token) {
      console.log("No token provided");
      return null;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Decoded token:", decoded);

    // ✅ Fix: Check if decoded is an object and has userId property
    if (typeof decoded === "string") {
      console.log("Token decoded as string");
      return null;
    }

    // ✅ Fix: Check if decoded is an object and has userId
    if (!decoded || typeof decoded !== "object" || !decoded.userId) {
      console.log("No userId in token");
      return null;
    }

    console.log("User authenticated:", decoded.userId);
    return decoded.userId;
  } catch(e) {
    console.error("Token verification error:", e);
    return null;
  }
}

// Helper function to get or create room
async function getOrCreateRoom(slug: string, userId: string) {
  try {
    const roomRepo = db.rooms();
    let room = await roomRepo.findOne({
      where: { slug: slug }
    });
    
    if (!room) {
      console.log(`Room "${slug}" not found, creating it...`);
      room = roomRepo.create({
        slug: slug,
        adminId: userId
      });
      await roomRepo.save(room);
      console.log(`Room "${slug}" created successfully with ID: ${room.id}`);
    } else {
      console.log(`Room "${slug}" found with ID: ${room.id}`);
    }
    
    return room;
  } catch (error) {
    console.error("Error in getOrCreateRoom:", error);
    throw error;
  }
}

wss.on('connection', function connection(ws, request) {
  console.log("New connection attempt");
  console.log("Request URL:", request.url);
  
  const url = request.url;
  if (!url) {
    console.log("No URL provided, closing connection");
    ws.close();
    return;
  }
  
  const queryParams = new URLSearchParams(url.split('?')[1]);
  const token = queryParams.get('token') || "";
  console.log("Token from query params:", token ? "Present" : "Missing");
  
  const userId = checkUser(token);

  if (userId == null) {
    console.log("Authentication failed, closing connection");
    ws.send(JSON.stringify({
      type: "error",
      message: "Authentication failed"
    }));
    ws.close();
    return;
  }

  const user: User = {
    userId,
    rooms: [],
    ws
  };
  
  users.push(user);

  console.log(`User ${userId} connected. Total users: ${users.length}`);

  // Send welcome message immediately
  ws.send(JSON.stringify({
    type: "connection",
    message: "Connected to WebSocket server",
    userId: userId
  }));

  ws.on('message', async function message(data) {
    console.log("Raw message received:", data.toString());
    
    let parsedData;
    try {
      parsedData = JSON.parse(data.toString());
      console.log("Parsed message type:", parsedData.type);
    } catch (error) {
      console.error("Failed to parse message:", error);
      ws.send(JSON.stringify({
        type: "error",
        message: "Invalid message format"
      }));
      return;
    }

    if (parsedData.type === "join_room") {
      const userObj = users.find(x => x.ws === ws);
      const roomSlug = parsedData.roomId;
      
      console.log(`User ${userId} trying to join room: ${roomSlug}`);
      
      if (userObj && !userObj.rooms.includes(roomSlug)) {
        try {
          // ✅ Get or create the room automatically
          const room = await getOrCreateRoom(roomSlug, userId);
          
          userObj.rooms.push(roomSlug);
          ws.send(JSON.stringify({
            type: "joined_room",
            roomId: roomSlug,
            message: `Successfully joined room: ${roomSlug}`,
            room: {
              id: room.id,
              slug: room.slug
            }
          }));
          console.log(`User ${userId} successfully joined room: ${roomSlug} (ID: ${room.id})`);
        } catch (error) {
          console.error("Error joining room:", error);
          ws.send(JSON.stringify({
            type: "error",
            message: "Database error while joining room"
          }));
        }
      } else if (userObj && userObj.rooms.includes(roomSlug)) {
        console.log(`User ${userId} already in room: ${roomSlug}`);
        ws.send(JSON.stringify({
          type: "info",
          message: `Already in room: ${roomSlug}`
        }));
      }
    }

    if (parsedData.type === "leave_room") {
      const userObj = users.find(x => x.ws === ws);
      if (!userObj) {
        return;
      }
      const roomSlug = parsedData.roomId;
      userObj.rooms = userObj.rooms.filter(x => x !== roomSlug);
      console.log(`User ${userId} left room: ${roomSlug}`);
    }

    if (parsedData.type === "chat") {
      const roomSlug = parsedData.roomId;
      const message = parsedData.message;

      console.log(`Chat message from ${userId} in room ${roomSlug}: ${message}`);

      try {
        // Get or create room (ensure it exists)
        const room = await getOrCreateRoom(roomSlug, userId);

        const chatRepo = db.chats();
        const chat = chatRepo.create({
          message: message,
          userId: userId,
          roomId: room.id
        });
        
        await chatRepo.save(chat);
        
        console.log(`Chat saved successfully to room ${roomSlug}`);

        // Broadcast to all users in the room
        let broadcastCount = 0;
        users.forEach(user => {
          // ✅ Fix: Check if user.ws exists and is open before sending
          if (user.rooms.includes(roomSlug) && user.ws.readyState === WebSocket.OPEN) {
            user.ws.send(JSON.stringify({
              type: "chat",
              message: message,
              roomId: roomSlug,
              userId: userId,
              createdAt: chat.createdAt
            }));
            broadcastCount++;
          }
        });
        console.log(`Broadcasted to ${broadcastCount} users in room ${roomSlug}`);
      } catch (error) {
        console.error("Error saving chat:", error);
        ws.send(JSON.stringify({
          type: "error",
          message: "Failed to save message"
        }));
      }
    }
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for user ${userId}:`, error);
  });

  ws.on("close", () => {
    const index = users.findIndex(x => x.ws === ws);
    if (index !== -1) {
      users.splice(index, 1);
    }
    console.log(`User ${userId} disconnected. Active users: ${users.length}`);
  });
});

console.log(`WebSocket server attempting to start on port 8080...`);