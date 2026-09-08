import { getExistingShapes } from "./http";
import { PersistedShape, Tool } from "@repo/shared-types";

const DEFAULT_FONT_SIZE = 20;
const SHAPE_COLOR = "rgba(255, 255, 255)";

type EraserRect = { x: number; y: number; width: number; height: number };

function newId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `shape-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class Game {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private shapes: PersistedShape[];
    private byId: Map<string, PersistedShape> = new Map();
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
    private presentUsers: Set<string> = new Set();
    private onPresenceChange?: (members: string[]) => void;

    // Selection state for the select tool (move + delete).
    private selectedId: string | null = null;
    private draggingShapeId: string | null = null;
    private dragOffsetX = 0;
    private dragOffsetY = 0;

    socket: WebSocket;

    constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket, onPresenceChange?: (members: string[]) => void) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d")!;
        this.shapes = [];
        this.roomId = roomId;
        this.socket = socket;
        this.clicked = false;
        this.onPresenceChange = onPresenceChange;

        this.updateCanvasScale();

        this.init();
        this.initHandlers();
        this.initMouseHandlers();
        this.initResizeHandler();
    }

    private updateCanvasScale() {
        const rect = this.canvas.getBoundingClientRect();
        this.scaleX = this.canvas.width / rect.width;
        this.scaleY = this.canvas.height / rect.height;
        this.offsetX = rect.left;
        this.offsetY = rect.top;
    }

    private initResizeHandler() {
        const handleResize = () => {
            this.updateCanvasScale();
            this.clearCanvas();
        };

        window.addEventListener('resize', handleResize);

        this.destroy = this.destroy.bind(this);
        const originalDestroy = this.destroy;
        this.destroy = () => {
            window.removeEventListener('resize', handleResize);
            originalDestroy();
        };
    }

    private getCanvasCoordinates(clientX: number, clientY: number): { x: number, y: number } {
        const rect = this.canvas.getBoundingClientRect();
        const x = (clientX - rect.left) * (this.canvas.width / rect.width);
        const y = (clientY - rect.top) * (this.canvas.height / rect.height);
        return { x, y };
    }

    private drawDiamond(x: number, y: number, width: number, height: number) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + width / 2, y);
        this.ctx.lineTo(x + width, y + height / 2);
        this.ctx.lineTo(x + width / 2, y + height);
        this.ctx.lineTo(x, y + height / 2);
        this.ctx.closePath();
        this.ctx.stroke();
    }

    // Index helpers -------------------------------------------------------
    private upsertShape(shape: PersistedShape) {
        const existing = this.byId.get(shape.id);
        if (existing) {
            this.byId.set(shape.id, shape);
            const idx = this.shapes.findIndex(s => s.id === shape.id);
            if (idx !== -1) this.shapes[idx] = shape;
        } else {
            this.byId.set(shape.id, shape);
            this.shapes.push(shape);
        }
    }

    private removeShapeById(id: string) {
        if (this.byId.delete(id)) {
            this.shapes = this.shapes.filter(s => s.id !== id);
        }
        if (this.selectedId === id) this.selectedId = null;
    }

    private removeShapesByIds(ids: string[]) {
        for (const id of ids) this.removeShapeById(id);
    }

    // Eraser: compute which shape ids intersect the eraser rectangle. ------
    private computeIntersectingIds(eraserRect: EraserRect): string[] {
        return this.shapes.filter(shape => this.intersects(shape, eraserRect)).map(s => s.id);
    }

    private intersects(shape: PersistedShape, eraserRect: EraserRect): boolean {
        if (!shape || typeof shape !== "object") return false;

        if (shape.type === "rect") {
            return this.rectsOverlap(eraserRect, { x: shape.x, y: shape.y, width: shape.width, height: shape.height });
        } else if (shape.type === "circle") {
            const circleBox = {
                x: shape.centerX - shape.radius,
                y: shape.centerY - shape.radius,
                width: shape.radius * 2,
                height: shape.radius * 2
            };
            return this.rectsOverlap(eraserRect, circleBox);
        } else if (shape.type === "diamond") {
            const diamondBox = {
                x: shape.centerX - shape.width / 2,
                y: shape.centerY - shape.height / 2,
                width: shape.width,
                height: shape.height
            };
            return this.rectsOverlap(eraserRect, diamondBox);
        } else if (shape.type === "pencil") {
            const minX = Math.min(shape.startX, shape.endX);
            const maxX = Math.max(shape.startX, shape.endX);
            const minY = Math.min(shape.startY, shape.endY);
            const maxY = Math.max(shape.startY, shape.endY);
            return this.rectsOverlap(eraserRect, { x: minX, y: minY, width: maxX - minX, height: maxY - minY });
        } else if (shape.type === "text") {
            return this.pointNear(shape.x, shape.y, eraserRect);
        }

        return false;
    }

    private rectsOverlap(a: EraserRect, b: EraserRect): boolean {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }

    private pointNear(px: number, py: number, r: EraserRect): boolean {
        const margin = 8;
        return px >= r.x - margin && px <= r.x + r.width + margin &&
               py >= r.y - margin && py <= r.y + r.height + margin;
    }

    // Hit testing for the select tool --------------------------------------
    private hitTest(x: number, y: number): PersistedShape | null {
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i]!;
            if (this.containsPoint(shape, x, y)) return shape;
        }
        return null;
    }

    private containsPoint(shape: PersistedShape, x: number, y: number): boolean {
        switch (shape.type) {
            case "rect":
                return x >= shape.x && x <= shape.x + shape.width &&
                       y >= shape.y && y <= shape.y + shape.height;
            case "circle": {
                const dx = x - shape.centerX;
                const dy = y - shape.centerY;
                return Math.sqrt(dx * dx + dy * dy) <= shape.radius;
            }
            case "diamond": {
                const halfWidth = shape.width / 2;
                const halfHeight = shape.height / 2;
                const dx = Math.abs(x - shape.centerX) / halfWidth;
                const dy = Math.abs(y - shape.centerY) / halfHeight;
                return dx + dy <= 1;
            }
            case "pencil":
                return this.distanceToLine(shape.startX, shape.startY, shape.endX, shape.endY, x, y) <= 5;
            case "text": {
                const fontSize = shape.fontSize;
                return x >= shape.x && x <= shape.x + (shape.text?.length ?? 0) * fontSize * 0.6 + fontSize &&
                       y >= shape.y - fontSize && y <= shape.y + fontSize;
            }
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

        let xx: number, yy: number;

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

    private translateShape(shape: PersistedShape, dx: number, dy: number): PersistedShape {
        switch (shape.type) {
            case "rect":
                return { ...shape, x: shape.x + dx, y: shape.y + dy };
            case "circle":
                return { ...shape, centerX: shape.centerX + dx, centerY: shape.centerY + dy };
            case "diamond":
                return { ...shape, centerX: shape.centerX + dx, centerY: shape.centerY + dy };
            case "pencil":
                return {
                    ...shape,
                    startX: shape.startX + dx,
                    startY: shape.startY + dy,
                    endX: shape.endX + dx,
                    endY: shape.endY + dy
                };
            case "text":
                return { ...shape, x: shape.x + dx, y: shape.y + dy };
            default:
                return shape;
        }
    }

    destroy() {
        this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
        this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
        this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
        this.canvas.removeEventListener("keydown", this.keyDownHandler);
    }

    setTool(tool: Tool) {
        this.selectedTool = tool;
        if (tool !== "select") {
            this.selectedId = null;
        }
        this.clearCanvas();
    }

    // Shape CRUD over WebSocket --------------------------------------------
    private sendShapeAdd(shape: PersistedShape) {
        this.socket.send(JSON.stringify({
            type: "shape_add",
            roomId: this.roomId,
            shape
        }));
    }

    private sendShapeUpdate(shape: PersistedShape) {
        this.socket.send(JSON.stringify({
            type: "shape_update",
            roomId: this.roomId,
            shapeId: shape.id,
            shape
        }));
    }

    private sendShapeDelete(shapeId: string) {
        this.socket.send(JSON.stringify({
            type: "shape_delete",
            roomId: this.roomId,
            shapeId
        }));
    }

    private sendShapeDeleteMany(shapeIds: string[]) {
        this.socket.send(JSON.stringify({
            type: "shape_delete_many",
            roomId: this.roomId,
            shapeIds
        }));
    }

    // Initialization ---------------------------------------------------------
    async init() {
        try {
            const fetched = await getExistingShapes(this.roomId);
            if (Array.isArray(fetched)) {
                for (const shape of fetched) this.upsertShape(shape);
            }
            console.log('Initialized shapes from server:', this.shapes.length);
        } catch (error) {
            console.error('Failed to preload shapes:', error);
        }
        // The HTTP preload acts as the authoritative initial snapshot. If a
        // joined_room message arrives afterwards via WS it will be merged on
        // top of these shapes (idempotent by id).
        this.isInitialized = true;
        this.clearCanvas();
    }

    initHandlers() {
        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                // --- Presence events ---
                if (message.type === "joined_room") {
                    if (Array.isArray(message.members)) {
                        this.presentUsers = new Set(message.members);
                        this.onPresenceChange?.(Array.from(this.presentUsers));
                    }
                    // Adopt the authoritative snapshot (with ids) sent by the server.
                    // Merge so any shapes drawn before join are not lost.
                    if (Array.isArray(message.shapes)) {
                        for (const s of message.shapes as PersistedShape[]) {
                            if (s && typeof s.id === "string") this.upsertShape(s);
                        }
                    }
                    this.isInitialized = true;
                    this.clearCanvas();
                    return;
                }

                if (message.type === "user_joined") {
                    if (message.userId) {
                        this.presentUsers.add(message.userId);
                        this.onPresenceChange?.(Array.from(this.presentUsers));
                    }
                    return;
                }

                if (message.type === "user_left") {
                    if (message.userId) {
                        this.presentUsers.delete(message.userId);
                        this.onPresenceChange?.(Array.from(this.presentUsers));
                    }
                    return;
                }
                // --- End presence events ---

                if (!this.isInitialized) return;

                // --- Shape CRUD events ---
                if (message.type === "shape_add" && message.shape && typeof message.shape.id === "string") {
                    this.upsertShape(message.shape as PersistedShape);
                    this.clearCanvas();
                    return;
                }

                if (message.type === "shape_update" && message.shape && typeof message.shape.id === "string") {
                    this.upsertShape(message.shape as PersistedShape);
                    this.clearCanvas();
                    return;
                }

                if (message.type === "shape_delete" && typeof message.shapeId === "string") {
                    this.removeShapeById(message.shapeId);
                    this.clearCanvas();
                    return;
                }

                if (message.type === "shape_delete_many" && Array.isArray(message.shapeIds)) {
                    this.removeShapesByIds(message.shapeIds.map(String));
                    this.clearCanvas();
                    return;
                }

                // --- Legacy chat-based shapes (backwards compatibility) ---
                if (message.type == "chat") {
                    const parsedData = JSON.parse(message.message);

                    if (parsedData.action === "erase") {
                        if (parsedData.eraserRect) {
                            const ids = this.computeIntersectingIds(parsedData.eraserRect);
                            this.removeShapesByIds(ids);
                        } else if (Array.isArray(parsedData.updatedShapes)) {
                            // Fallback: adopt snapshot of legacy clients.
                            const snapshot = (parsedData.updatedShapes as { id?: string }[]).filter(s => s && typeof s.id === "string");
                            if (snapshot.length > 0) {
                                this.shapes = this.shapes.filter(s => snapshot.some(snap => snap.id === s.id) ? true : false);
                            }
                        }
                        this.clearCanvas();
                    } else if (parsedData.shape && parsedData.shape.type) {
                        // Legacy shape without id: assign an id so it stays first-class.
                        const legacy = parsedData.shape as PersistedShape;
                        if (typeof legacy.id !== "string") {
                            legacy.id = newId();
                            legacy.userId = "";
                        }
                        this.upsertShape(legacy);
                        this.clearCanvas();
                    }
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        }
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(0, 0, 0)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!Array.isArray(this.shapes)) {
            this.shapes = [];
            return;
        }

        this.ctx.strokeStyle = SHAPE_COLOR;
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = SHAPE_COLOR;
        this.ctx.lineJoin = "round";
        this.ctx.lineCap = "round";

        for (const shape of this.shapes) {
            try {
                this.drawShape(shape);
            } catch (drawError) {
                console.error("Error drawing shape:", drawError, shape);
            }
        }

        // Highlight the selected shape.
        if (this.selectedId) {
            const selected = this.byId.get(this.selectedId);
            if (selected) {
                this.drawSelectionBox(selected);
            } else {
                this.selectedId = null;
            }
        }
    }

    private drawShape(shape: PersistedShape) {
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
            this.drawDiamond(shape.centerX - shape.width / 2, shape.centerY - shape.height / 2, shape.width, shape.height);
        } else if (shape.type === "text") {
            this.ctx.font = `${shape.fontSize}px sans-serif`;
            this.ctx.fillStyle = shape.color ?? SHAPE_COLOR;
            this.ctx.textBaseline = "top";
            this.ctx.fillText(shape.text, shape.x, shape.y);
            this.ctx.fillStyle = SHAPE_COLOR;
        }
    }

    private drawSelectionBox(shape: PersistedShape) {
        let box: { x: number; y: number; width: number; height: number };
        switch (shape.type) {
            case "rect":
                box = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
                break;
            case "circle":
                box = {
                    x: shape.centerX - shape.radius,
                    y: shape.centerY - shape.radius,
                    width: shape.radius * 2,
                    height: shape.radius * 2
                };
                break;
            case "diamond":
                box = {
                    x: shape.centerX - shape.width / 2,
                    y: shape.centerY - shape.height / 2,
                    width: shape.width,
                    height: shape.height
                };
                break;
            case "pencil":
                box = {
                    x: Math.min(shape.startX, shape.endX),
                    y: Math.min(shape.startY, shape.endY),
                    width: Math.abs(shape.endX - shape.startX),
                    height: Math.abs(shape.endY - shape.startY)
                };
                break;
            case "text":
                box = {
                    x: shape.x,
                    y: shape.y - shape.fontSize,
                    width: shape.text.length * shape.fontSize * 0.6 + shape.fontSize,
                    height: shape.fontSize * 1.4
                };
                break;
            default:
                return;
        }

        this.ctx.strokeStyle = "rgba(96, 165, 250, 0.9)";
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);
        this.ctx.strokeRect(box.x - 3, box.y - 3, box.width + 6, box.height + 6);
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = SHAPE_COLOR;
        this.ctx.lineWidth = 2;
    }

    // Mouse handlers --------------------------------------------------------
    mouseDownHandler = (e: MouseEvent) => {
        this.clicked = true;
        const { x, y } = this.getCanvasCoordinates(e.clientX, e.clientY);
        this.startX = x;
        this.startY = y;

        if (this.selectedTool === "select") {
            const hit = this.hitTest(x, y);
            if (hit) {
                this.selectedId = hit.id;
                this.draggingShapeId = hit.id;
                this.dragOffsetX = x - this.shapeAnchorX(hit);
                this.dragOffsetY = y - this.shapeAnchorY(hit);
                this.clearCanvas();
            } else {
                this.selectedId = null;
                this.draggingShapeId = null;
                this.clearCanvas();
            }
        }
    }

    private shapeAnchorX(shape: PersistedShape): number {
        switch (shape.type) {
            case "rect": return shape.x;
            case "circle": return shape.centerX;
            case "diamond": return shape.centerX;
            case "pencil": return shape.startX;
            case "text": return shape.x;
            default: return 0;
        }
    }

    private shapeAnchorY(shape: PersistedShape): number {
        switch (shape.type) {
            case "rect": return shape.y;
            case "circle": return shape.centerY;
            case "diamond": return shape.centerY;
            case "pencil": return shape.startY;
            case "text": return shape.y;
            default: return 0;
        }
    }

    mouseUpHandler = (e: MouseEvent) => {
        if (!this.clicked) return;

        this.clicked = false;
        const { x, y } = this.getCanvasCoordinates(e.clientX, e.clientY);
        const width = x - this.startX;
        const height = y - this.startY;

        // Select tool: finish moving a dragged shape.
        if (this.selectedTool === "select") {
            this.draggingShapeId = null;
            return;
        }

        // Text tool: prompt for content and create a text shape.
        if (this.selectedTool === "text") {
            const text = window.prompt("Enter text:");
            if (text && text.trim().length > 0) {
                const shape: PersistedShape = {
                    type: "text",
                    id: newId(),
                    userId: "",
                    x: Math.min(this.startX, x),
                    y: Math.min(this.startY, y),
                    text: text,
                    fontSize: DEFAULT_FONT_SIZE
                };
                this.upsertShape(shape);
                this.clearCanvas();
                this.sendShapeAdd(shape);
            }
            return;
        }

        const selectedTool = this.selectedTool;
        let shape: PersistedShape | null = null;

        if (selectedTool === "rect") {
            shape = {
                type: "rect",
                id: newId(),
                userId: "",
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
                id: newId(),
                userId: "",
                radius: radius,
                centerX: centerX,
                centerY: centerY,
            }
        } else if (selectedTool === "pencil") {
            shape = {
                type: "pencil",
                id: newId(),
                userId: "",
                startX: this.startX,
                startY: this.startY,
                endX: x,
                endY: y,
            }
        } else if (selectedTool === "diamond") {
            shape = {
                type: "diamond",
                id: newId(),
                userId: "",
                centerX: this.startX + (width / 2),
                centerY: this.startY + (height / 2),
                width: Math.abs(width),
                height: Math.abs(height),
            }
        } else if (selectedTool === "eraser") {
            const eraserRect = {
                x: Math.min(this.startX, x),
                y: Math.min(this.startY, y),
                width: Math.abs(width),
                height: Math.abs(height)
            };

            if (eraserRect.width > 0 && eraserRect.height > 0) {
                const beforeCount = this.shapes.length;
                const ids = this.computeIntersectingIds(eraserRect);
                this.removeShapesByIds(ids);

                console.log(`Eraser removed ${beforeCount - this.shapes.length} shapes`);

                if (ids.length > 0) {
                    this.clearCanvas();
                    this.sendShapeDeleteMany(ids);
                }
            }

            return;
        }

        if (!shape) {
            return;
        }

        this.upsertShape(shape);
        this.clearCanvas();
        this.sendShapeAdd(shape);
    }

    mouseMoveHandler = (e: MouseEvent) => {
        if (!this.clicked) return;

        const { x, y } = this.getCanvasCoordinates(e.clientX, e.clientY);

        // Select tool -> drag the selected shape live.
        if (this.selectedTool === "select" && this.draggingShapeId) {
            const current = this.byId.get(this.draggingShapeId);
            if (current) {
                const moved = this.translateShape(
                    current,
                    x - this.dragOffsetX - this.shapeAnchorX(current),
                    y - this.dragOffsetY - this.shapeAnchorY(current)
                );
                this.upsertShape(moved);
                this.clearCanvas();
                // Broadcast the move (throttled by mousemove rate).
                this.sendShapeUpdate(moved);
            }
            return;
        }

        const width = x - this.startX;
        const height = y - this.startY;

        this.clearCanvas();

        this.ctx.strokeStyle = SHAPE_COLOR;
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        this.ctx.lineJoin = "round";
        this.ctx.lineCap = "round";

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
            this.drawDiamond(centerX - Math.abs(width) / 2, centerY - Math.abs(height) / 2, Math.abs(width), Math.abs(height));
        } else if (this.selectedTool === "eraser") {
            const drawX = width > 0 ? this.startX : x;
            const drawY = height > 0 ? this.startY : y;
            this.ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
            this.ctx.fillRect(drawX, drawY, Math.abs(width), Math.abs(height));
        } else if (this.selectedTool === "text") {
            // Show a small marker where text will be placed.
            this.ctx.fillStyle = "rgba(96, 165, 250, 0.6)";
            this.ctx.fillRect(x, y, 2, 2);
        }
    }

    keyDownHandler = (e: KeyboardEvent) => {
        if ((e.key === "Delete" || e.key === "Backspace") && this.selectedId) {
            e.preventDefault();
            const id = this.selectedId;
            this.removeShapeById(id);
            this.clearCanvas();
            this.sendShapeDelete(id);
        }
    }

    initMouseHandlers() {
        this.canvas.addEventListener("mousedown", this.mouseDownHandler);
        this.canvas.addEventListener("mouseup", this.mouseUpHandler);
        this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
        this.canvas.addEventListener("keydown", this.keyDownHandler);
        this.canvas.tabIndex = 0;
    }

    public resize(width: number, height: number) {
        const shapesBackup = [...this.shapes];

        this.canvas.width = width;
        this.canvas.height = height;

        this.shapes = shapesBackup;
        this.byId = new Map(this.shapes.map(s => [s.id, s]));
        this.updateCanvasScale();
        this.clearCanvas();
    }
}