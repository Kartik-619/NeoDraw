// app/canvas/[roomId]/page.tsx
import axios from "axios";
import { HTTP_BACKEND } from "@/config";
import { RoomCanvas } from "@/components/RoomCanvas";
import { notFound } from 'next/navigation';

// ✅ Generate static params for known rooms (optional)
export async function generateStaticParams() {
    // If you have a way to fetch all room slugs
    // Otherwise return empty array
    return [];
}

async function getRoom(slug: string) {
    try {
        const res = await axios.get(`${HTTP_BACKEND}/room/${slug}`, {
            timeout: 5000
        });
        
        if (!res.data.room) {
            return null;
        }
        return res.data.room;
    } catch (error) {
        console.error("Error fetching room:", error);
        return null;
    }
}

// ✅ Use correct typing for Next.js 15
interface PageProps {
    params: Promise<{
        roomId: string;
    }>;
}

export default async function CanvasPage({ params }: PageProps) {
    // ✅ Must await params
    const { roomId } = await params;
    
    console.log("CanvasPage - roomId from params:", roomId);
    
    // ✅ Validate immediately
    if (!roomId || roomId === "undefined") {
        console.error("Invalid roomId:", roomId);
        notFound();
    }
    
    // Fetch room data
    const room = await getRoom(roomId);
    
    if (!room) {
        notFound();
    }
    
    // ✅ Pass valid roomId
    return <RoomCanvas roomId={roomId} />;
}