import { Tool } from "@/components/Canvas";
import { getExistingShapes } from "./http";

type Shape = {
    type: "rect";
    x: number;
    y: number;
    width: number;
    height: number;
} | {
    type: "circle";
    centerX: number;
    centerY: number;
    radius: number;
} | {
    type: "pencil";
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private existingShapes: Shape[]
    private roomId: string;
    private clicked: boolean;
    private startX = 0;
    private startY = 0;
    private selectedTool: Tool = "circle";
    private scaleX: number = 1;
    private scaleY: number = 1;
    private offsetX: number = 0;
    private offsetY: number = 0;

    socket: WebSocket;

    constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d")!;
        this.existingShapes = [];
        this.roomId = roomId;
        this.socket = socket;
        this.clicked = false;
        
        // Calculate initial scale
        this.updateCanvasScale();
        
        this.init();
        this.initHandlers();
        this.initMouseHandlers();
        this.initResizeHandler();
    }
    
    // Update canvas scale based on actual canvas dimensions
    private updateCanvasScale() {
        const rect = this.canvas.getBoundingClientRect();
        this.scaleX = this.canvas.width / rect.width;
        this.scaleY = this.canvas.height / rect.height;
        this.offsetX = rect.left;
        this.offsetY = rect.top;
    }

    // Handle window resize
    private initResizeHandler() {
        const handleResize = () => {
            this.updateCanvasScale();
            this.clearCanvas(); // Redraw everything after resize
        };
        
        window.addEventListener('resize', handleResize);
        
        // Store cleanup function
        this.destroy = this.destroy.bind(this);
        const originalDestroy = this.destroy;
        this.destroy = () => {
            window.removeEventListener('resize', handleResize);
            originalDestroy();
        };
    }

    // Convert client coordinates to canvas coordinates
    private getCanvasCoordinates(clientX: number, clientY: number): { x: number, y: number } {
        const rect = this.canvas.getBoundingClientRect();
        const x = (clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (clientY - rect.top) * (this.canvas.height / rect.height);
        return { x, y };
    }

    destroy() {
        this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
        this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
        this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
    }

    setTool(tool: "circle" | "pencil" | "rect") {
        this.selectedTool = tool;
    }

    async init() {
        this.existingShapes = await getExistingShapes(this.roomId);
        console.log(this.existingShapes);
        this.clearCanvas();
    }

    initHandlers() {
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.type == "chat") {
                const parsedShape = JSON.parse(message.message);
                this.existingShapes.push(parsedShape.shape);
                this.clearCanvas();
            }
        }
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(0, 0, 0)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Set stroke style for all shapes
        this.ctx.strokeStyle = "rgba(255, 255, 255)";
        this.ctx.lineWidth = 2;

        this.existingShapes.forEach((shape) => {
            if (shape.type === "rect") {
                this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
            } else if (shape.type === "circle") {
                this.ctx.beginPath();
                this.ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.closePath();                
            } else if (shape.type === "pencil") {
                this.ctx.beginPath();
                this.ctx.moveTo(shape.startX, shape.startY);
                this.ctx.lineTo(shape.endX, shape.endY);
                this.ctx.stroke();
                this.ctx.closePath();
            }
        });
    }

    mouseDownHandler = (e: MouseEvent) => {
        this.clicked = true;
        const { x, y } = this.getCanvasCoordinates(e.clientX, e.clientY);
        this.startX = x;
        this.startY = y;
    }

    mouseUpHandler = (e: MouseEvent) => {
        if (!this.clicked) return;
        
        this.clicked = false;
        const { x, y } = this.getCanvasCoordinates(e.clientX, e.clientY);
        const width = x - this.startX;
        const height = y - this.startY;

        const selectedTool = this.selectedTool;
        let shape: Shape | null = null;
        
        if (selectedTool === "rect") {
            shape = {
                type: "rect",
                x: this.startX,
                y: this.startY,
                height,
                width
            }
        } else if (selectedTool === "circle") {
            const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
            const centerX = this.startX + (width / 2);
            const centerY = this.startY + (height / 2);
            shape = {
                type: "circle",
                radius: radius,
                centerX: centerX,
                centerY: centerY,
            }
        } else if (selectedTool === "pencil") {
            shape = {
                type: "pencil",
                startX: this.startX,
                startY: this.startY,
                endX: x,
                endY: y,
            }
        }

        if (!shape) {
            return;
        }

        this.existingShapes.push(shape);
        this.clearCanvas();

        this.socket.send(JSON.stringify({
            type: "chat",
            message: JSON.stringify({
                shape
            }),
            roomId: this.roomId
        }));
    }

    mouseMoveHandler = (e: MouseEvent) => {
        if (this.clicked) {
            const { x, y } = this.getCanvasCoordinates(e.clientX, e.clientY);
            const width = x - this.startX;
            const height = y - this.startY;
            
            // Clear and redraw all shapes
            this.clearCanvas();
            
            // Draw temporary shape while dragging
            this.ctx.strokeStyle = "rgba(255, 255, 255)";
            this.ctx.lineWidth = 2;
            
            if (this.selectedTool === "rect") {
                this.ctx.strokeRect(this.startX, this.startY, width, height);   
            } else if (this.selectedTool === "circle") {
                const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
                const centerX = this.startX + (width / 2);
                const centerY = this.startY + (height / 2);
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, Math.abs(radius), 0, Math.PI * 2);
                this.ctx.stroke();
                this.ctx.closePath();                
            } else if (this.selectedTool === "pencil") {
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(x, y);
                this.ctx.stroke();
                this.ctx.closePath();
            }
        }
    }

    initMouseHandlers() {
        this.canvas.addEventListener("mousedown", this.mouseDownHandler);
        this.canvas.addEventListener("mouseup", this.mouseUpHandler);
        this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
    }

    // Public method to handle resize from Canvas component
    public resize(width: number, height: number) {
        // Store existing shapes temporarily
        const existingShapesBackup = [...this.existingShapes];
        
        // Resize canvas
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Restore shapes and redraw
        this.existingShapes = existingShapesBackup;
        this.updateCanvasScale();
        this.clearCanvas();
    }
}