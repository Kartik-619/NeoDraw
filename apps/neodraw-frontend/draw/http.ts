import { HTTP_BACKEND } from "@/config";
import { Shape, Tool } from "@repo/shared-types";
import axios from "axios";

export async function getExistingShapes(roomId: string): Promise<Shape[]> {
    const res = await axios.get(`${HTTP_BACKEND}/rooms/${roomId}/chats`);
    const messages = res.data.messages;

    if (!Array.isArray(messages)) {
        return [];
    }

    const shapes: Shape[] = [];

    for (const x of messages as { message: string }[]) {
        try {
            const messageData = JSON.parse(x.message);
            if (messageData && messageData.shape && messageData.shape.type) {
                const t = messageData.shape.type as Tool;
                if (["rect", "circle", "pencil", "diamond", "eraser"].includes(t)) {
                    shapes.push(messageData.shape as Shape);
                }
            }
        } catch {
            // Skip non-shape chat messages
        }
    }

    return shapes;
}