import { HTTP_BACKEND } from "@/config";
import { PersistedShape, isValidShape } from "@repo/shared-types";
import axios from "axios";

export async function getExistingShapes(roomId: string): Promise<PersistedShape[]> {
    const res = await axios.get(`${HTTP_BACKEND}/rooms/${roomId}/shapes`);
    const shapes = res.data.shapes;

    if (!Array.isArray(shapes)) {
        return [];
    }

    return (shapes as PersistedShape[]).filter(s =>
        s && typeof s === "object" && typeof s.id === "string" && isValidShape(s)
    );
}