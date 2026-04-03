import axios from "axios";
import { HTTP_BACKEND } from "@/config";
import { RoomCanvas } from "@/components/RoomCanvas";

async function getRoomId(slug: string) {
    const res = await axios.get(`${HTTP_BACKEND}/room/${slug}`);

    if (!res.data.room) {
        throw new Error("Room not found");
    }
    console.log(res.data);
    return res.data.room.slug;
}

export default async function CanvasPage({
    params
}: {
    params: { roomId: string } // actually slug
}) {
    const slug = params.roomId;

    const roomId = await getRoomId(slug);

    return <RoomCanvas roomId={roomId} />;
}