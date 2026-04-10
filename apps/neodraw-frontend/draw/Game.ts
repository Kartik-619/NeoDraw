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
} | {
    type: "diamond";
    centerX: number;
    centerY: number;
    width: number;
    height: number;
} | {
    type: "eraser";
    x: number;
    y: number;
    width: number;
    height: number;
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
    private eraserRadius: number = 20;
    private isInitialized: boolean = false;

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

    // Draw diamond shape
    private drawDiamond(x: number, y: number, width: number, height: number) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + width / 2, y); // Top point
        this.ctx.lineTo(x + width, y + height / 2); // Right point
        this.ctx.lineTo(x + width / 2, y + height); // Bottom point
        this.ctx.lineTo(x, y + height / 2); // Left point
        this.ctx.closePath();
        this.ctx.stroke();
    }

    // Check if a point is inside a shape (for eraser)
    private isPointInsideShape(shape: Shape, x: number, y: number): boolean {
        switch (shape.type) {
            case "rect":
                return x >= shape.x && x <= shape.x + shape.width &&
                       y >= shape.y && y <= shape.y + shape.height;
            case "circle":
                const dx = x - shape.centerX;
                const dy = y - shape.centerY;
                return Math.sqrt(dx * dx + dy * dy) <= shape.radius;
            case "diamond":
                const halfWidth = shape.width / 2;
                const halfHeight = shape.height / 2;
                const centerX = shape.centerX;
                const centerY = shape.centerY;
                const dxDiamond = Math.abs(x - centerX) / halfWidth;
                const dyDiamond = Math.abs(y - centerY) / halfHeight;
                return dxDiamond + dyDiamond <= 1;
            case "pencil":
                // Check if point is near the line
                const distance = this.distanceToLine(shape.startX, shape.startY, shape.endX, shape.endY, x, y);
                return distance <= 5;
            default:
                return false;
        }
    }

    private distanceToLine(x1: number, y1: number, x2: number, y2: number, px: number, py: number): number {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }

    destroy() {
        this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
        this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
        this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
    }

    setTool(tool: Tool) {
        this.selectedTool = tool;
    }

    async init() {
        try {
            this.existingShapes = await getExistingShapes(this.roomId);
            // Ensure existingShapes is an array and filter out any invalid shapes
            if (!Array.isArray(this.existingShapes)) {
                this.existingShapes = [];
            }
            this.existingShapes = this.existingShapes.filter(shape => shape && typeof shape === 'object' && shape.type);
            console.log('Initialized shapes:', this.existingShapes.length);
            this.isInitialized = true;
            this.clearCanvas();
        } catch (error) {
            console.error('Failed to initialize shapes:', error);
            this.existingShapes = [];
            this.isInitialized = true;
            this.clearCanvas();
        }
    }

    initHandlers() {
        this.socket.onmessage = (event) => {
            if (!this.isInitialized) return;
            
            try {
                const message = JSON.parse(event.data);

                if (message.type == "chat") {
                    const parsedData = JSON.parse(message.message);
                    
                    // Handle eraser action from other users
                    if (parsedData.action === "erase") {
                        console.log('Received eraser action');
                        
                        if (parsedData.updatedShapes && Array.isArray(parsedData.updatedShapes)) {
                            // Use the updated shapes sent by the erasing client
                            this.existingShapes = parsedData.updatedShapes;
                        } else if (parsedData.eraserRect) {
                            // Apply the same eraser logic locally
                            const { eraserRect } = parsedData;
                            this.existingShapes = this.existingShapes.filter(shape => {
                                // Skip undefined shapes
                                if (!shape || typeof shape !== 'object') return false;
                                
                                // Check if shape intersects with eraser rectangle
                                if (shape.type === "rect") {
                                    return !(eraserRect.x < shape.x + shape.width &&
                                           eraserRect.x + eraserRect.width > shape.x &&
                                           eraserRect.y < shape.y + shape.height &&
                                           eraserRect.y + eraserRect.height > shape.y);
                                } else if (shape.type === "circle") {
                                    const circleBox = {
                                        x: shape.centerX - shape.radius,
                                        y: shape.centerY - shape.radius,
                                        width: shape.radius * 2,
                                        height: shape.radius * 2
                                    };
                                    return !(eraserRect.x < circleBox.x + circleBox.width &&
                                           eraserRect.x + eraserRect.width > circleBox.x &&
                                           eraserRect.y < circleBox.y + circleBox.height &&
                                           eraserRect.y + eraserRect.height > circleBox.y);
                                } else if (shape.type === "diamond") {
                                    const diamondBox = {
                                        x: shape.centerX - shape.width/2,
                                        y: shape.centerY - shape.height/2,
                                        width: shape.width,
                                        height: shape.height
                                    };
                                    return !(eraserRect.x < diamondBox.x + diamondBox.width &&
                                           eraserRect.x + eraserRect.width > diamondBox.x &&
                                           eraserRect.y < diamondBox.y + diamondBox.height &&
                                           eraserRect.y + eraserRect.height > diamondBox.y);
                                } else if (shape.type === "pencil") {
                                    // For pencil, check if the line intersects with eraser rectangle
                                    const minX = Math.min(shape.startX, shape.endX);
                                    const maxX = Math.max(shape.startX, shape.endX);
                                    const minY = Math.min(shape.startY, shape.endY);
                                    const maxY = Math.max(shape.startY, shape.endY);
                                    
                                    return !(eraserRect.x < maxX &&
                                           eraserRect.x + eraserRect.width > minX &&
                                           eraserRect.y < maxY &&
                                           eraserRect.y + eraserRect.height > minY);
                                }
                                return true;
                            });
                        }
                        
                        this.clearCanvas();
                    } 
                    // Handle new shape
                    else if (parsedData.shape && parsedData.shape.type) {
                        this.existingShapes.push(parsedData.shape);
                        this.clearCanvas();
                    }
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        }
    }

    clearCanvas() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(0, 0, 0)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Safety check: ensure existingShapes is an array
        if (!Array.isArray(this.existingShapes)) {
            console.error('existingShapes is not an array:', this.existingShapes);
            this.existingShapes = [];
            return;
        }
        
        // Filter out invalid shapes
        const validShapes = this.existingShapes.filter(shape => {
            if (!shape || typeof shape !== 'object') {
                console.warn('Invalid shape (not an object):', shape);
                return false;
            }
            if (!shape.type || typeof shape.type !== 'string') {
                console.warn('Shape missing type property:', shape);
                return false;
            }
            return true;
        });
        
        // Set drawing styles
        this.ctx.strokeStyle = "rgba(255, 255, 255)";
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = "rgba(255, 255, 255)";
        
        // Draw all valid shapes
        validShapes.forEach((shape, index) => {
            try {
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
                } else if (shape.type === "diamond") {
                    this.drawDiamond(shape.centerX - shape.width/2, shape.centerY - shape.height/2, shape.width, shape.height);
                } else if (shape.type === "eraser") {
                    this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                    this.ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
                    this.ctx.fillStyle = "rgba(255, 255, 255)";
                }
            } catch (drawError) {
                console.error(`Error drawing shape at index ${index}:`, drawError, shape);
            }
        });
        
        // Log if we filtered out any shapes
        if (validShapes.length !== this.existingShapes.length) {
            console.warn(`Filtered out ${this.existingShapes.length - validShapes.length} invalid shapes`);
        }
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
                x: Math.min(this.startX, x),
                y: Math.min(this.startY, y),
                height: Math.abs(height),
                width: Math.abs(width)
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
        } else if (selectedTool === "diamond") {
            shape = {
                type: "diamond",
                centerX: this.startX + (width / 2),
                centerY: this.startY + (height / 2),
                width: Math.abs(width),
                height: Math.abs(height),
            }
        } else if (selectedTool === "eraser") {
            // Eraser: Remove shapes that intersect with the eraser rectangle
            const eraserRect = {
                x: Math.min(this.startX, x),
                y: Math.min(this.startY, y),
                width: Math.abs(width),
                height: Math.abs(height)
            };
            
            // Only apply eraser if the rectangle has some area
            if (eraserRect.width > 0 && eraserRect.height > 0) {
                // Filter out shapes that intersect with eraser
                const beforeCount = this.existingShapes.length;
                
                this.existingShapes = this.existingShapes.filter(shape => {
                    // Skip undefined or invalid shapes
                    if (!shape || typeof shape !== 'object') {
                        return false;
                    }
                    
                    // Check if shape intersects with eraser rectangle
                    if (shape.type === "rect") {
                        return !(eraserRect.x < shape.x + shape.width &&
                               eraserRect.x + eraserRect.width > shape.x &&
                               eraserRect.y < shape.y + shape.height &&
                               eraserRect.y + eraserRect.height > shape.y);
                    } else if (shape.type === "circle") {
                        // Simple bounding box check for circles
                        const circleBox = {
                            x: shape.centerX - shape.radius,
                            y: shape.centerY - shape.radius,
                            width: shape.radius * 2,
                            height: shape.radius * 2
                        };
                        return !(eraserRect.x < circleBox.x + circleBox.width &&
                               eraserRect.x + eraserRect.width > circleBox.x &&
                               eraserRect.y < circleBox.y + circleBox.height &&
                               eraserRect.y + eraserRect.height > circleBox.y);
                    } else if (shape.type === "diamond") {
                        const diamondBox = {
                            x: shape.centerX - shape.width/2,
                            y: shape.centerY - shape.height/2,
                            width: shape.width,
                            height: shape.height
                        };
                        return !(eraserRect.x < diamondBox.x + diamondBox.width &&
                               eraserRect.x + eraserRect.width > diamondBox.x &&
                               eraserRect.y < diamondBox.y + diamondBox.height &&
                               eraserRect.y + eraserRect.height > diamondBox.y);
                    } else if (shape.type === "pencil") {
                        // For lines, check if the line segment intersects with eraser rectangle
                        const minX = Math.min(shape.startX, shape.endX);
                        const maxX = Math.max(shape.startX, shape.endX);
                        const minY = Math.min(shape.startY, shape.endY);
                        const maxY = Math.max(shape.startY, shape.endY);
                        
                        return !(eraserRect.x < maxX &&
                               eraserRect.x + eraserRect.width > minX &&
                               eraserRect.y < maxY &&
                               eraserRect.y + eraserRect.height > minY);
                    }
                    return true;
                });
                
                const afterCount = this.existingShapes.length;
                console.log(`Eraser removed ${beforeCount - afterCount} shapes`);
                
                this.clearCanvas();
                
                // Broadcast the eraser action with updated shapes
                this.socket.send(JSON.stringify({
                    type: "chat",
                    message: JSON.stringify({
                        action: "erase",
                        eraserRect,
                        updatedShapes: this.existingShapes
                    }),
                    roomId: this.roomId
                }));
            }
            
            return; // Don't add eraser as a shape
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
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
            
            if (this.selectedTool === "rect") {
                const drawX = width > 0 ? this.startX : x;
                const drawY = height > 0 ? this.startY : y;
                this.ctx.strokeRect(drawX, drawY, Math.abs(width), Math.abs(height));   
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
            } else if (this.selectedTool === "diamond") {
                const centerX = this.startX + (width / 2);
                const centerY = this.startY + (height / 2);
                this.drawDiamond(centerX - Math.abs(width)/2, centerY - Math.abs(height)/2, Math.abs(width), Math.abs(height));
            } else if (this.selectedTool === "eraser") {
                // Show eraser rectangle
                const drawX = width > 0 ? this.startX : x;
                const drawY = height > 0 ? this.startY : y;
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
                this.ctx.fillRect(drawX, drawY, Math.abs(width), Math.abs(height));
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