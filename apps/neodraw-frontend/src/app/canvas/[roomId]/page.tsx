import { notFound } from "next/navigation";
import { RoomCanvas } from "@/components/RoomCanvas";
import { HTTP_BACKEND } from "@/lib/config";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function CanvasPage({ params }: PageProps) {
  const { roomId } = await params;

  try {
    const res = await fetch(`${HTTP_BACKEND}/room/${roomId}`, { cache: "no-store" });
    if (!res.ok) notFound();
    const room = await res.json() as { roomId: number; slug: string };

    return <RoomCanvas roomId={room.slug} />;
  } catch {
    notFound();
  }
}
