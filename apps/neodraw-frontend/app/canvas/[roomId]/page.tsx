// app/canvas/[roomId]/page.tsx
import axios from "axios";
import { HTTP_BACKEND } from "@/config";
import { RoomCanvas } from "@/components/RoomCanvas";

async function getRoom(slug: string) {
    const res = await axios.get(`${HTTP_BACKEND}/room/${slug}`);
    
    if (!res.data.room) {
        throw new Error("Room not found");
    }
    console.log("Room data:", res.data);
    return res.data.room; // Return the entire room object
}

export default async function CanvasPage({
    params
}: {
    params: { roomId: string } // This is actually the slug
}) {
    const slug = params.roomId;
    const room = await getRoom(slug);
    
    // Pass the slug as roomId since that's what the WebSocket expects
    return <RoomCanvas roomId={slug} />;
}