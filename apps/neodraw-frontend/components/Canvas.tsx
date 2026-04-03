"use client";

import { initDraw } from "@/draw";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { Circle, Pencil, RectangleHorizontalIcon } from "lucide-react";
import { Game } from "@/draw/Game";

export type Tool = "circle" | "rect" | "pencil";

export function Canvas({
    roomId,
    socket
}: {
    socket: WebSocket;
    roomId: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [game, setGame] = useState<Game>();
    const [selectedTool, setSelectedTool] = useState<Tool>("circle");
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Handle window resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                setDimensions({ width, height });
                
                // Update canvas dimensions
                if (canvasRef.current) {
                    canvasRef.current.width = width;
                    canvasRef.current.height = height;
                    
                    // Notify game about resize if needed
                    if (game) {
                        game.resize(width, height);
                    }
                }
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        
        return () => {
            window.removeEventListener('resize', updateDimensions);
        };
    }, [game]);

    useEffect(() => {
        game?.setTool(selectedTool);
    }, [selectedTool, game]);

    useEffect(() => {
        if (canvasRef.current && dimensions.width > 0 && dimensions.height > 0) {
            const g = new Game(canvasRef.current, roomId, socket);
            setGame(g);

            return () => {
                g.destroy();
            }
        }
    }, [canvasRef, dimensions.width, dimensions.height, roomId, socket]);

    return (
        <div 
            ref={containerRef}
            style={{
                height: "100vh",
                width: "100vw",
                overflow: "hidden",
                position: "relative"
            }}
        >
            <canvas 
                ref={canvasRef} 
                width={dimensions.width} 
                height={dimensions.height}
                style={{
                    display: "block",
                    width: "100%",
                    height: "100%"
                }}
            />
            <Topbar setSelectedTool={setSelectedTool} selectedTool={selectedTool} />
        </div>
    );
}

function Topbar({selectedTool, setSelectedTool}: {
    selectedTool: Tool,
    setSelectedTool: (s: Tool) => void
}) {
    return (
        <div style={{
            position: "fixed",
            top: 10,
            left: 10,
            zIndex: 10
        }}>
            <div className="flex gap-t">
                <IconButton 
                    onClick={() => {
                        setSelectedTool("pencil")
                    }}
                    activated={selectedTool === "pencil"}
                    icon={<Pencil />}
                />
                <IconButton 
                    onClick={() => {
                        setSelectedTool("rect")
                    }} 
                    activated={selectedTool === "rect"} 
                    icon={<RectangleHorizontalIcon />} 
                />
                <IconButton 
                    onClick={() => {
                        setSelectedTool("circle")
                    }} 
                    activated={selectedTool === "circle"} 
                    icon={<Circle />}
                />
            </div>
        </div>
    );
}