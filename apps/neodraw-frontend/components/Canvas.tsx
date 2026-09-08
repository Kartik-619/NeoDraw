"use client";

import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { Circle, Pencil, RectangleHorizontalIcon, Diamond, Eraser, Share2, Type, MousePointer2 } from "lucide-react";
import { Game } from "@/draw/Game";
import { Tool } from "@repo/shared-types";

export function Canvas({
    roomId,
    socket,
    initialMembers = []
}: {
    socket: WebSocket;
    roomId: string;
    initialMembers?: string[];
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [game, setGame] = useState<Game>();
    const [selectedTool, setSelectedTool] = useState<Tool>("circle");
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [members, setMembers] = useState<string[]>(initialMembers);

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
            const g = new Game(canvasRef.current, roomId, socket, setMembers);
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
                    cursor: selectedTool === "eraser" ? "cell"
                        : selectedTool === "select" ? "default"
                        : selectedTool === "text" ? "text"
                        : "crosshair"
                }}
            />
            <Topbar setSelectedTool={setSelectedTool} selectedTool={selectedTool} roomId={roomId} members={members}/>
        </div>
    );
}

function Topbar({selectedTool, roomId,setSelectedTool, members}: {
    selectedTool: Tool,
    roomId:string,
    setSelectedTool: (s: Tool) => void,
    members: string[]
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
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px"
        }}>
            <div style={{
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
                        onClick={() => setSelectedTool("text")}
                        activated={selectedTool === "text"} 
                        icon={<Type size={20} />}
                    />
                    <IconButton 
                        onClick={() => setSelectedTool("select")}
                        activated={selectedTool === "select"} 
                        icon={<MousePointer2 size={20} />}
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
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                color: "#fff",
                padding: "4px 12px",
                borderRadius: "1rem",
                fontSize: "12px",
                fontWeight: 500,
                backdropFilter: "blur(8px)"
            }}>
                <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "#22c55e",
                    display: "inline-block"
                }} />
                {members.length} online
            </div>
        </div>
    );
}