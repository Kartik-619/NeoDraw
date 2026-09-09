import type { PersistedShape, Shape, Tool, ServerShapeMessage } from "@repo/shared-types";
import { newId } from "@repo/shared-types";
import { getExistingShapes } from "./http";
import { OperationHistory, type HistoryEntry } from "./History";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

const PRESET_COLORS = ["#000000", "#f5564e", "#fecb2f", "#4cc9f0", "#05ce81", "#a78bfa"];

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private roomId: string;
  private socket: WebSocket;
  private shapes: PersistedShape[] = [];
  private byId: Map<string, PersistedShape> = new Map();
  private tool: Tool = "rect";
  private isDrawing = false;
  private isDragging = false;
  private isPanning = false;
  private isInitialized = false;
  private readOnly = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private selectedShapeId: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private dragStartShape: PersistedShape | null = null;
  private panStartX = 0;
  private panStartY = 0;
  private panStartViewX = 0;
  private panStartViewY = 0;
  private spaceHeld = false;
  private color = "#000000";
  private viewX = 0;
  private viewY = 0;
  private zoom = 1;
  private history = new OperationHistory();
  onHistoryChange: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.roomId = roomId;
    this.socket = socket;
    this.resize();

    // Bind mouse handlers as arrow functions for stable removeEventListener
    this.mouseDownHandler = this.mouseDownHandler.bind(this);
    this.mouseMoveHandler = this.mouseMoveHandler.bind(this);
    this.mouseUpHandler = this.mouseUpHandler.bind(this);
    this.wheelHandler = this.wheelHandler.bind(this);
    this.keyDownHandler = this.keyDownHandler.bind(this);
    this.keyUpHandler = this.keyUpHandler.bind(this);
  }

  async init(): Promise<void> {
    const shapes = await getExistingShapes(this.roomId);
    for (const shape of shapes) {
      this.upsertShape(shape);
    }
    this.isInitialized = true;
    this.draw();
    this.initHandlers();
    this.addListeners();
  }

  destroy(): void {
    this.removeListeners();
  }

  resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  setTool(tool: Tool): void {
    this.tool = tool;
    this.selectedShapeId = null;
    this.draw();
  }

  getTool(): Tool {
    return this.tool;
  }

  setColor(color: string): void {
    this.color = color;
  }

  getColor(): string {
    return this.color;
  }

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
    if (readOnly) {
      this.isDrawing = false;
      this.isDragging = false;
      this.selectedShapeId = null;
      this.tool = "select";
    }
    this.draw();
  }

  isReadOnly(): boolean {
    return this.readOnly;
  }

  getHistoryState(): HistoryState {
    return { canUndo: this.history.canUndo, canRedo: this.history.canRedo };
  }

  undo(): void {
    this.applyHistoryEntry(this.history.popUndo(), true);
  }

  redo(): void {
    this.applyHistoryEntry(this.history.popRedo(), false);
  }

  exportShapes(): PersistedShape[] {
    return [...this.shapes];
  }

  // --- Viewport (zoom / pan) ---

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.viewX) / this.zoom, y: (sy - this.viewY) / this.zoom };
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx * this.zoom + this.viewX, y: wy * this.zoom + this.viewY };
  }

  getZoom(): number {
    return this.zoom;
  }

  zoomIn(): void {
    this.applyZoom(this.zoom * 1.25, this.canvas.width / 2, this.canvas.height / 2);
  }

  zoomOut(): void {
    this.applyZoom(this.zoom / 1.25, this.canvas.width / 2, this.canvas.height / 2);
  }

  resetZoom(): void {
    this.zoom = 1;
    this.viewX = 0;
    this.viewY = 0;
    this.draw();
  }

  private applyZoom(nextZoom: number, screenX: number, screenY: number): void {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const world = this.screenToWorld(screenX, screenY);
    this.zoom = clamped;
    this.viewX = screenX - world.x * this.zoom;
    this.viewY = screenY - world.y * this.zoom;
    this.draw();
  }

  // --- State management ---

  private upsertShape(shape: PersistedShape): void {
    const existing = this.byId.get(shape.id);
    if (existing) {
      const idx = this.shapes.findIndex((s) => s.id === shape.id);
      if (idx !== -1) this.shapes[idx] = shape;
    } else {
      this.shapes.push(shape);
    }
    this.byId.set(shape.id, shape);
  }

  private removeShapeById(id: string): void {
    this.byId.delete(id);
    this.shapes = this.shapes.filter((s) => s.id !== id);
    if (this.selectedShapeId === id) this.selectedShapeId = null;
  }

  private removeShapesByIds(ids: string[]): void {
    const idSet = new Set(ids);
    this.byId = new Map([...this.byId].filter(([k]) => !idSet.has(k)));
    this.shapes = this.shapes.filter((s) => !idSet.has(s.id));
    if (this.selectedShapeId && idSet.has(this.selectedShapeId)) this.selectedShapeId = null;
  }

  private replaceShapeById(shape: PersistedShape): void {
    this.upsertShape(shape);
  }

  // --- Undo / redo ---

  private applyHistoryEntry(entry: HistoryEntry | null, isUndo: boolean): void {
    if (!entry) return;
    if (isUndo) {
      switch (entry.kind) {
        case "add":
          this.history.pushRedo({ kind: "add", shape: entry.shape });
          this.sendShapeDelete(entry.shape.id);
          this.removeShapeById(entry.shape.id);
          break;
        case "update":
          this.history.pushRedo({ kind: "update", shapeId: entry.shapeId, before: entry.before, after: entry.after });
          this.sendShapeUpdate(entry.shapeId, entry.before);
          this.replaceShapeById(entry.before);
          break;
        case "delete":
          this.history.pushRedo({ kind: "delete", shapes: entry.shapes });
          for (const shape of entry.shapes) {
            this.sendShape(shape);
            this.replaceShapeById(shape);
          }
          break;
      }
    } else {
      switch (entry.kind) {
        case "add":
          this.history.push({ kind: "add", shape: entry.shape });
          this.sendShape(entry.shape);
          this.replaceShapeById(entry.shape);
          break;
        case "update":
          this.history.push({ kind: "update", shapeId: entry.shapeId, before: entry.before, after: entry.after });
          this.sendShapeUpdate(entry.shapeId, entry.after);
          this.replaceShapeById(entry.after);
          break;
        case "delete":
          this.history.push({ kind: "delete", shapes: entry.shapes });
          this.sendShapeDeleteMany(entry.shapes.map((s) => s.id));
          this.removeShapesByIds(entry.shapes.map((s) => s.id));
          break;
      }
    }
    this.draw();
    this.onHistoryChange?.();
  }

  private notifyHistoryChange(): void {
    this.onHistoryChange?.();
  }

  // --- WebSocket handlers ---

  private initHandlers(): void {
    this.socket.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerShapeMessage;
        this.handleServerMessage(msg);
      } catch { /* ignore */ }
    });
  }

  private handleServerMessage(msg: ServerShapeMessage): void {
    if (!this.isInitialized) return;

    switch (msg.type) {
      case "joined_room":
        for (const shape of msg.shapes) {
          this.upsertShape(shape);
        }
        this.draw();
        break;
      case "shape_add":
        this.upsertShape(msg.shape);
        this.draw();
        break;
      case "shape_update":
        this.upsertShape(msg.shape);
        this.draw();
        break;
      case "shape_delete":
        this.removeShapeById(msg.shapeId);
        this.draw();
        break;
      case "shape_delete_many":
        this.removeShapesByIds(msg.shapeIds);
        this.draw();
        break;
    }
  }

  // --- Rendering ---

  private draw(): void {
    this.clearCanvas();
    for (const shape of this.shapes) {
      try {
        this.drawShape(shape);
      } catch { /* skip bad shape */ }
    }
    if (this.selectedShapeId) {
      const sel = this.byId.get(this.selectedShapeId);
      if (sel) this.drawSelectionBox(sel);
    }
    if (this.isDrawing) {
      this.drawPreview();
    }
  }

  private clearCanvas(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(this.zoom, 0, 0, this.zoom, this.viewX, this.viewY);
  }

  private drawShape(shape: PersistedShape): void {
    const color = shape.color ?? "#000000";
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2 / this.zoom;

    switch (shape.type) {
      case "rect":
        this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
        break;
      case "circle":
        this.ctx.beginPath();
        this.ctx.arc(shape.centerX, shape.centerY, shape.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        break;
      case "diamond": {
        const { centerX, centerY, width, height } = shape;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY - height / 2);
        this.ctx.lineTo(centerX + width / 2, centerY);
        this.ctx.lineTo(centerX, centerY + height / 2);
        this.ctx.lineTo(centerX - width / 2, centerY);
        this.ctx.closePath();
        this.ctx.stroke();
        break;
      }
      case "pencil":
        this.ctx.beginPath();
        this.ctx.moveTo(shape.startX, shape.startY);
        this.ctx.lineTo(shape.endX, shape.endY);
        this.ctx.stroke();
        break;
      case "text":
        this.ctx.fillStyle = color;
        this.ctx.font = `${shape.fontSize}px system-ui`;
        this.ctx.fillText(shape.text, shape.x, shape.y);
        this.ctx.fillStyle = "#ffffff";
        break;    }
  }

  private drawSelectionBox(shape: PersistedShape): void {
    this.ctx.strokeStyle = "#6366f1";
    this.ctx.lineWidth = 1 / this.zoom;
    this.ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);

    const bounds = this.getShapeBounds(shape);
    if (bounds) {
      this.ctx.strokeRect(bounds.x - 5 / this.zoom, bounds.y - 5 / this.zoom, bounds.w + 10 / this.zoom, bounds.h + 10 / this.zoom);
    }
    this.ctx.setLineDash([]);
  }

  private drawPreview(): void {
    this.ctx.strokeStyle = "#888";
    this.ctx.lineWidth = 1 / this.zoom;
    this.ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);

    switch (this.tool) {
      case "rect":
        this.ctx.strokeRect(this.startX, this.startY, this.currentX - this.startX, this.currentY - this.startY);
        break;
      case "circle": {
        const cx = (this.startX + this.currentX) / 2;
        const cy = (this.startY + this.currentY) / 2;
        const r = Math.sqrt((this.currentX - this.startX) ** 2 + (this.currentY - this.startY) ** 2) / 2;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.stroke();
        break;
      }
      case "diamond": {
        const dcx = (this.startX + this.currentX) / 2;
        const dcy = (this.startY + this.currentY) / 2;
        const dw = Math.abs(this.currentX - this.startX);
        const dh = Math.abs(this.currentY - this.startY);
        this.ctx.beginPath();
        this.ctx.moveTo(dcx, dcy - dh / 2);
        this.ctx.lineTo(dcx + dw / 2, dcy);
        this.ctx.lineTo(dcx, dcy + dh / 2);
        this.ctx.lineTo(dcx - dw / 2, dcy);
        this.ctx.closePath();
        this.ctx.stroke();
        break;
      }
      case "pencil":
        this.ctx.beginPath();
        this.ctx.moveTo(this.startX, this.startY);
        this.ctx.lineTo(this.currentX, this.currentY);
        this.ctx.stroke();
        break;
      case "eraser":
        this.ctx.strokeStyle = "#ef4444";
        this.ctx.strokeRect(this.startX, this.startY, this.currentX - this.startX, this.currentY - this.startY);
        break;
    }
    this.ctx.setLineDash([]);
  }

  private getShapeBounds(shape: PersistedShape): { x: number; y: number; w: number; h: number } | null {
    switch (shape.type) {
      case "rect": {
        const x = Math.min(shape.x, shape.x + shape.width);
        const y = Math.min(shape.y, shape.y + shape.height);
        return { x, y, w: Math.abs(shape.width), h: Math.abs(shape.height) };
      }
      case "circle":
        return { x: shape.centerX - shape.radius, y: shape.centerY - shape.radius, w: shape.radius * 2, h: shape.radius * 2 };
      case "diamond":
        return { x: shape.centerX - shape.width / 2, y: shape.centerY - shape.height / 2, w: shape.width, h: shape.height };
      case "pencil":
        return { x: Math.min(shape.startX, shape.endX), y: Math.min(shape.startY, shape.endY), w: Math.abs(shape.endX - shape.startX), h: Math.abs(shape.endY - shape.startY) };
      case "text":
        return { x: shape.x, y: shape.y - shape.fontSize, w: shape.text.length * shape.fontSize * 0.6, h: shape.fontSize };
      default:
        return null;
    }
  }

  // --- Hit testing ---

  private hitTest(x: number, y: number): PersistedShape | null {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const shape = this.shapes[i];
      if (!shape) continue;
      const bounds = this.getShapeBounds(shape);
      if (bounds && x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h) {
        return shape;
      }
    }
    return null;
  }

  private computeIntersectingIds(x1: number, y1: number, x2: number, y2: number): string[] {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    const ids: string[] = [];
    for (const shape of this.shapes) {
      const bounds = this.getShapeBounds(shape);
      if (!bounds) continue;

      // Bounding box intersection
      if (bounds.x < maxX && bounds.x + bounds.w > minX && bounds.y < maxY && bounds.y + bounds.h > minY) {
        ids.push(shape.id);
      }
    }
    return ids;
  }

  // --- Shape sending ---

  private sendShape(shape: PersistedShape): void {
    this.socket.send(JSON.stringify({ type: "shape_add", roomId: this.roomId, shape }));
  }

  private sendShapeUpdate(shapeId: string, shape: Partial<Shape>): void {
    this.socket.send(JSON.stringify({ type: "shape_update", roomId: this.roomId, shapeId, shape }));
  }

  private sendShapeDelete(shapeId: string): void {
    this.socket.send(JSON.stringify({ type: "shape_delete", roomId: this.roomId, shapeId }));
  }

  private sendShapeDeleteMany(shapeIds: string[]): void {
    this.socket.send(JSON.stringify({ type: "shape_delete_many", roomId: this.roomId, shapeIds }));
  }

  // --- Mouse handlers ---

  private mouseDownHandler(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = this.screenToWorld(screen.x, screen.y);
    const x = world.x;
    const y = world.y;

    this.startX = x;
    this.startY = y;
    this.currentX = x;
    this.currentY = y;

    // Middle-drag or space+drag pans the viewport
    if (e.button === 1 || (e.button === 0 && this.spaceHeld)) {
      e.preventDefault();
      this.isPanning = true;
      this.panStartX = e.clientX;
      this.panStartY = e.clientY;
      this.panStartViewX = this.viewX;
      this.panStartViewY = this.viewY;
      return;
    }

    if (this.readOnly || this.tool === "select") {
      if (e.button === 0 && !this.readOnly) {
        const hit = this.hitTest(x, y);
        if (hit) {
          this.selectedShapeId = hit.id;
          this.isDragging = true;
          const bounds = this.getShapeBounds(hit);
          if (bounds) {
            this.dragOffsetX = x - bounds.x;
            this.dragOffsetY = y - bounds.y;
          }
          this.dragStartShape = { ...hit };
        } else {
          this.selectedShapeId = null;
        }
        this.draw();
      }
      return;
    }

    if (this.tool === "text") {
      const text = window.prompt("Enter text:");
      if (text) {
        const shape: PersistedShape = {
          id: newId(),
          userId: "",
          type: "text",
          x,
          y,
          text,
          fontSize: 20,
          color: this.color,
        };
        this.upsertShape(shape);
        this.sendShape(shape);
        this.history.push({ kind: "add", shape });
        this.notifyHistoryChange();
        this.draw();
      }
      return;
    }

    this.isDrawing = true;
    this.draw();
  }

  private mouseMoveHandler(e: MouseEvent): void {
    if (this.isPanning) {
      this.viewX = this.panStartViewX + (e.clientX - this.panStartX);
      this.viewY = this.panStartViewY + (e.clientY - this.panStartY);
      this.draw();
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = this.screenToWorld(screen.x, screen.y);
    const x = world.x;
    const y = world.y;
    this.currentX = x;
    this.currentY = y;

    if (this.isDragging && this.selectedShapeId) {
      const shape = this.byId.get(this.selectedShapeId);
      if (shape) {
        const updated = { ...shape };
        const dx = x - this.dragOffsetX - (this.getShapeBounds(shape)?.x ?? 0);
        const dy = y - this.dragOffsetY - (this.getShapeBounds(shape)?.y ?? 0);

        switch (updated.type) {
          case "rect":
          case "text":
            updated.x += dx;
            updated.y += dy;
            break;
          case "circle":
          case "diamond":
            updated.centerX += dx;
            updated.centerY += dy;
            break;
          case "pencil":
            updated.startX += dx;
            updated.startY += dy;
            updated.endX += dx;
            updated.endY += dy;
            break;
        }

        this.upsertShape(updated);
        this.sendShapeUpdate(updated.id, updated);
        this.draw();
      }
      return;
    }

    if (this.isDrawing) {
      this.draw();
    }
  }

  private mouseUpHandler(e: MouseEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    if (this.isDragging) {
      this.isDragging = false;
      const shape = this.dragStartShape;
      const current = this.selectedShapeId ? this.byId.get(this.selectedShapeId) : null;
      if (shape && current && JSON.stringify(shape) !== JSON.stringify(current)) {
        this.history.push({ kind: "update", shapeId: shape.id, before: shape, after: current });
        this.notifyHistoryChange();
      }
      this.dragStartShape = null;
      return;
    }

    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.tool === "eraser") {
      const rect = this.canvas.getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const world = this.screenToWorld(screen.x, screen.y);
      const ids = this.computeIntersectingIds(this.startX, this.startY, world.x, world.y);
      if (ids.length > 0) {
        const removed = ids
          .map((id) => this.byId.get(id))
          .filter((s): s is PersistedShape => Boolean(s));
        this.removeShapesByIds(ids);
        this.sendShapeDeleteMany(ids);
        if (removed.length > 0) {
          this.history.push({ kind: "delete", shapes: removed });
          this.notifyHistoryChange();
        }
        this.draw();
      }
      return;
    }

    let shape: PersistedShape | null = null;

    switch (this.tool) {
      case "rect":
        shape = { id: newId(), userId: "", type: "rect", x: this.startX, y: this.startY, width: this.currentX - this.startX, height: this.currentY - this.startY, color: this.color };
        break;
      case "circle": {
        const cx = (this.startX + this.currentX) / 2;
        const cy = (this.startY + this.currentY) / 2;
        const r = Math.sqrt((this.currentX - this.startX) ** 2 + (this.currentY - this.startY) ** 2) / 2;
        shape = { id: newId(), userId: "", type: "circle", centerX: cx, centerY: cy, radius: r, color: this.color };
        break;
      }
      case "diamond": {
        const dcx = (this.startX + this.currentX) / 2;
        const dcy = (this.startY + this.currentY) / 2;
        shape = { id: newId(), userId: "", type: "diamond", centerX: dcx, centerY: dcy, width: Math.abs(this.currentX - this.startX), height: Math.abs(this.currentY - this.startY), color: this.color };
        break;
      }
      case "pencil":
        shape = { id: newId(), userId: "", type: "pencil", startX: this.startX, startY: this.startY, endX: this.currentX, endY: this.currentY, color: this.color };
        break;
    }

    if (shape) {
      this.upsertShape(shape);
      this.sendShape(shape);
      this.history.push({ kind: "add", shape });
      this.notifyHistoryChange();
      this.draw();
    }
  }

  private wheelHandler(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.002);
    this.applyZoom(this.zoom * factor, screenX, screenY);
  }

  private keyDownHandler(e: KeyboardEvent): void {
    const metaPressed = e.ctrlKey || e.metaKey;

    if (e.key === " ") {
      this.spaceHeld = true;
      e.preventDefault();
      return;
    }

    if (metaPressed && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }

    if (metaPressed && e.key.toLowerCase() === "y") {
      e.preventDefault();
      this.redo();
      return;
    }

    if (metaPressed && (e.key === "=" || e.key === "+")) {
      e.preventDefault();
      this.zoomIn();
      return;
    }

    if (metaPressed && (e.key === "-" || e.key === "_")) {
      e.preventDefault();
      this.zoomOut();
      return;
    }

    if (metaPressed && e.key === "0") {
      e.preventDefault();
      this.resetZoom();
      return;
    }

    if ((e.key === "Delete" || e.key === "Backspace") && this.selectedShapeId && !this.readOnly) {
      const selected = this.byId.get(this.selectedShapeId);
      if (selected) {
        this.history.push({ kind: "delete", shapes: [selected] });
        this.sendShapeDelete(this.selectedShapeId);
        this.removeShapeById(this.selectedShapeId);
        this.notifyHistoryChange();
        this.draw();
      }
    }
  }

  private keyUpHandler(e: KeyboardEvent): void {
    if (e.key === " ") {
      this.spaceHeld = false;
    }
  }

  // --- Event listener management ---

  private addListeners(): void {
    this.canvas.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
    this.canvas.addEventListener("mouseup", this.mouseUpHandler);
    this.canvas.addEventListener("wheel", this.wheelHandler, { passive: false });
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
  }

  private removeListeners(): void {
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
    this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
    this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
    this.canvas.removeEventListener("wheel", this.wheelHandler);
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
  }
}

export { PRESET_COLORS };