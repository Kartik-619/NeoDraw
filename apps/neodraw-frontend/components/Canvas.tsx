"use client";

import { initDraw } from "@/draw";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { Circle, Pencil, RectangleHorizontalIcon, Diamond, Eraser,Share2 } from "lucide-react";
import { Game } from "@/draw/Game";

export type Tool = "circle" | "rect" | "pencil" | "diamond" | "eraser";

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
                backgroundColor:'#fcfefe',
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
                    height: "100%",
                    backgroundColor:'#fcfefe',
                    cursor: selectedTool === "eraser" ? "cell" : "crosshair"
                }}
            />
            <Topbar setSelectedTool={setSelectedTool} selectedTool={selectedTool} roomId={roomId}/>
        </div>
    );
}

function Topbar({selectedTool, roomId,setSelectedTool}: {
    selectedTool: Tool,
    roomId:string,
    setSelectedTool: (s: Tool) => void
}) {


    const CopyLink = async () => {
        if (!roomId) return;
    
        const url = `${window.location.origin}/canvas/${roomId}`;
    
        try {
            await navigator.clipboard.writeText(url);
            alert("Link copied ✅");
        } catch {
            alert("Failed to copy link");
        }
    };


    return (
        <div style={{
            position: "absolute",
            justifySelf:'center',
            top: 10,
            zIndex: 10,
            backgroundColor: "rgba(186, 174, 174, 0.7)",
            padding: "2px",
            borderRadius: "2rem",
            backdropFilter: "blur(8px)"
        }}>
            <div style={{ display: "flex", gap: "8px" }}>
                <IconButton 
                    onClick={() => setSelectedTool("pencil")}
                    activated={selectedTool === "pencil"}
                    icon={<Pencil size={20} />}
                />
                <IconButton 
                    onClick={() => setSelectedTool("rect")}
                    activated={selectedTool === "rect"} 
                    icon={<RectangleHorizontalIcon size={20} />} 
                />
                <IconButton 
                    onClick={() => setSelectedTool("circle")}
                    activated={selectedTool === "circle"} 
                    icon={<Circle size={20} />}
                />
                <IconButton 
                    onClick={() => setSelectedTool("diamond")}
                    activated={selectedTool === "diamond"} 
                    icon={<Diamond size={20} />}
                />
                <IconButton 
                    onClick={() => setSelectedTool("eraser")}
                    activated={selectedTool === "eraser"} 
                    icon={<Eraser size={20} />}
                />
                  <IconButton 
                    onClick={CopyLink}
                  activated={false}
                    icon={<Share2 size={20} />}
                />
            </div>
        </div>
    );
}