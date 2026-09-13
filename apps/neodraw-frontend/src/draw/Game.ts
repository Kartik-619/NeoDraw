import type { PersistedShape, Shape, Tool, ServerShapeMessage } from "@repo/shared-types";
import { newId } from "@repo/shared-types";
import { getExistingShapes } from "./http";
import { OperationHistory, type HistoryEntry } from "./History";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;

const PRESET_COLORS = ["#000000", "#f5564e", "#fecb2f", "#4cc9f0", "#05ce81", "#a78bfa"];
const TEXT_FONT_SIZE = 20;

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
  private eraserRemoved: PersistedShape[] = [];
  private eraserPrevX = 0;
  private eraserPrevY = 0;
  private freehandPoints: Point[] = [];
  private textEditor: HTMLTextAreaElement | null = null;
  private textEditorWorldX = 0;
  private textEditorWorldY = 0;
  private destroyed = false;
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
    if (this.destroyed) return;
    for (const shape of shapes) {
      this.upsertShape(shape);
    }
    this.isInitialized = true;
    this.draw();
    this.initHandlers();
    this.addListeners();
  }

  destroy(): void {
    this.destroyed = true;
    this.removeListeners();
    this.textEditor?.remove();
    this.textEditor = null;
  }

  resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.draw();
  }

  setTool(tool: Tool): void {
    if (this.tool !== tool) this.cancelActiveGesture();
    this.commitTextEditor();
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
    this.commitTextEditor();
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
    this.layoutTextEditor();
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
      case "freehand":
        this.ctx.lineCap = "round";
        buildFreehandPath(this.ctx, shape.points);
        this.ctx.stroke();
        break;
      case "text": {
        const lines = shape.text.split("\n");
        const lineHeight = shape.fontSize * 1.2;
        this.ctx.fillStyle = color;
        this.ctx.font = `${shape.fontSize}px system-ui`;
        this.ctx.textBaseline = "alphabetic";
        for (let i = 0; i < lines.length; i++) {
          this.ctx.fillText(lines[i] ?? "", shape.x, shape.y + i * lineHeight);
        }
        this.ctx.fillStyle = "#ffffff";
        break;
      }
    }
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
      case "freehand":
        buildFreehandPath(this.ctx, this.freehandPoints);
        this.ctx.stroke();
        break;
      case "eraser":
        this.ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
        this.ctx.fillRect(this.startX, this.startY, this.currentX - this.startX, this.currentY - this.startY);
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
      case "freehand": {
        if (shape.points.length === 0) return null;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const p of shape.points) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }
      case "text":
        return textShapeBounds(shape);
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

    const pad = 1 / this.zoom;
    const ids: string[] = [];
    for (const shape of this.shapes) {
      if (shapeIntersectsRect(shape, minX - pad, minY - pad, maxX + pad, maxY + pad)) {
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

  // --- Text editor ---

  private isTextEditing(): boolean {
    return this.textEditor !== null && this.textEditor.style.display !== "none";
  }

  private ensureTextEditor(): HTMLTextAreaElement {
    const existing = this.textEditor;
    if (existing) return existing;

    const parent = this.canvas.parentElement;
    if (!parent) throw new Error("Canvas parent element not found");

    const el = document.createElement("textarea");
    el.setAttribute("aria-label", "Text on canvas");
    el.style.position = "absolute";
    el.style.zIndex = "10";
    el.style.boxSizing = "border-box";
    el.style.padding = "0";
    el.style.margin = "0";
    el.style.border = "1px dashed #6366f1";
    el.style.background = "rgba(255,255,255,0.85)";
    el.style.outline = "none";
    el.style.fontFamily = "system-ui, sans-serif";
    el.style.lineHeight = "1.2";
    el.style.whiteSpace = "pre";
    el.style.overflow = "hidden";
    el.style.resize = "none";
    el.style.minWidth = "140px";
    el.style.minHeight = "24px";
    el.style.display = "none";
    el.addEventListener("input", () => this.autoResizeTextEditor());
    el.addEventListener("keydown", (e) => this.handleTextEditorKeyDown(e));
    el.addEventListener("blur", () => this.commitTextEditor());
    parent.appendChild(el);
    this.textEditor = el;
    return el;
  }

  private openTextEditor(x: number, y: number): void {
    this.commitTextEditor();
    const el = this.ensureTextEditor();
    this.textEditorWorldX = x;
    this.textEditorWorldY = y;
    el.value = "";
    el.style.display = "block";
    el.style.color = this.color;
    this.layoutTextEditor();
    this.autoResizeTextEditor();
    el.focus();
    requestAnimationFrame(() => {
      if (this.isTextEditing() && document.activeElement !== el) el.focus();
    });
  }

  private hideTextEditor(): void {
    const el = this.textEditor;
    if (!el) return;
    el.style.display = "none";
    el.value = "";
  }

  private commitTextEditor(): void {
    const el = this.textEditor;
    if (!el || el.style.display === "none") return;

    const x = this.textEditorWorldX;
    const y = this.textEditorWorldY;
    const color = this.color;
    const text = el.value.replace(/^\n+/, "").replace(/[ \t]+\n/g, "\n").replace(/\s+$/, "");
    this.hideTextEditor();
    if (!text) return;

    const shape: PersistedShape = {
      id: newId(),
      userId: "",
      type: "text",
      x,
      y,
      text,
      fontSize: TEXT_FONT_SIZE,
      color,
    };
    this.upsertShape(shape);
    this.sendShape(shape);
    this.history.push({ kind: "add", shape });
    this.notifyHistoryChange();
    this.draw();
  }

  private cancelTextEditor(): void {
    this.hideTextEditor();
  }

  private layoutTextEditor(): void {
    const el = this.textEditor;
    if (!el || el.style.display === "none") return;
    const screen = this.worldToScreen(this.textEditorWorldX, this.textEditorWorldY);
    const fontSizePx = TEXT_FONT_SIZE * this.zoom;
    el.style.left = `${screen.x}px`;
    el.style.top = `${screen.y - fontSizePx}px`;
    el.style.fontSize = `${fontSizePx}px`;
    el.style.color = this.color;
  }

  private autoResizeTextEditor(): void {
    const el = this.textEditor;
    if (!el || el.style.display === "none") return;
    const minWidth = parseFloat(el.style.minWidth || "0");
    const minHeight = parseFloat(el.style.minHeight || "0");
    el.style.width = `${Math.max(minWidth, el.scrollWidth + 1)}px`;
    el.style.height = `${Math.max(minHeight, el.scrollHeight + 1)}px`;
  }

  private handleTextEditorKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.cancelTextEditor();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      this.commitTextEditor();
    }
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

    if (e.button !== 0) return;

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
      e.preventDefault();
      this.openTextEditor(x, y);
      return;
    }

    if (this.tool === "eraser") {
      this.eraserRemoved = [];
      this.eraserPrevX = x;
      this.eraserPrevY = y;
    }

    if (this.tool === "freehand") {
      this.freehandPoints = [{ x, y }];
    }

    this.isDrawing = true;
    this.draw();
  }

  private eraseSweep(x: number, y: number): void {
    const minX = Math.min(this.eraserPrevX, x);
    const maxX = Math.max(this.eraserPrevX, x);
    const minY = Math.min(this.eraserPrevY, y);
    const maxY = Math.max(this.eraserPrevY, y);

    const ids = this.computeIntersectingIds(minX, minY, maxX, maxY);
    if (ids.length > 0) {
      const removed: PersistedShape[] = [];
      for (const id of ids) {
        const shape = this.byId.get(id);
        if (shape) removed.push(shape);
      }
      this.eraserRemoved.push(...removed);
      this.removeShapesByIds(ids);
      this.sendShapeDeleteMany(ids);
    }

    this.eraserPrevX = x;
    this.eraserPrevY = y;
    this.draw();
  }

  private cancelActiveGesture(): void {
    const wasErasing = this.isDrawing && this.tool === "eraser" && this.eraserRemoved.length > 0;
    this.isDrawing = false;
    this.isDragging = false;
    this.isPanning = false;
    if (wasErasing) {
      this.history.push({ kind: "delete", shapes: this.eraserRemoved });
      this.notifyHistoryChange();
    }
    this.eraserRemoved = [];
    this.freehandPoints = [];
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

    if (this.isDrawing && this.tool === "eraser") {
      this.eraseSweep(x, y);
      return;
    }

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
          case "freehand":
            updated.points = updated.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
            break;
        }

        this.upsertShape(updated);
        this.sendShapeUpdate(updated.id, updated);
        this.draw();
      }
      return;
    }

    if (this.isDrawing) {
      if (this.tool === "freehand") {
        const last = this.freehandPoints[this.freehandPoints.length - 1];
        if (!last || Math.hypot(x - last.x, y - last.y) > (4 / this.zoom)) {
          this.freehandPoints.push({ x, y });
        }
      }
      this.draw();
    }
  }

  private mouseUpHandler(_e: MouseEvent): void {
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
      const x = this.currentX;
      const y = this.currentY;
      const moved = Math.abs(x - this.startX) > 0.5 / this.zoom || Math.abs(y - this.startY) > 0.5 / this.zoom;

      if (!moved) {
        const ids = this.computeIntersectingIds(x, y, x, y);
        if (ids.length > 0) {
          const removed: PersistedShape[] = [];
          for (const id of ids) {
            const shape = this.byId.get(id);
            if (shape) removed.push(shape);
          }
          this.eraserRemoved.push(...removed);
          this.removeShapesByIds(ids);
          this.sendShapeDeleteMany(ids);
        }
      }

      if (this.eraserRemoved.length > 0) {
        this.history.push({ kind: "delete", shapes: this.eraserRemoved });
        this.notifyHistoryChange();
      }
      this.eraserRemoved = [];
      this.draw();
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
      case "freehand": {
        const pts = this.freehandPoints;
        const first = pts[0];
        const points: Point[] = pts.length >= 2 || !first ? pts : [first, { x: first.x, y: first.y }];
        shape = { id: newId(), userId: "", type: "freehand", points, color: this.color };
        this.freehandPoints = [];
        break;
      }
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
    if (this.isTextEditing()) return;
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
    if (this.isTextEditing()) return;
    if (e.key === " ") {
      this.spaceHeld = false;
    }
  }

  // --- Event listener management ---

  private addListeners(): void {
    this.canvas.addEventListener("mousedown", this.mouseDownHandler);
    window.addEventListener("mousemove", this.mouseMoveHandler);
    window.addEventListener("mouseup", this.mouseUpHandler);
    this.canvas.addEventListener("wheel", this.wheelHandler, { passive: false });
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
  }

  private removeListeners(): void {
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
    window.removeEventListener("mousemove", this.mouseMoveHandler);
    window.removeEventListener("mouseup", this.mouseUpHandler);
    this.canvas.removeEventListener("wheel", this.wheelHandler);
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
  }
}

// --- Geometry helpers (world coordinates) ---

interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Point {
  x: number;
  y: number;
}

function buildFreehandPath(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  if (points.length < 3) {
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p) ctx.lineTo(p.x, p.y);
    }
    return;
  }
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    if (!current || !next) continue;
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = points[points.length - 1];
  if (last) ctx.lineTo(last.x, last.y);
}

function polylineIntersectsRect(
  points: Point[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  if (points.length === 0) return false;
  if (points.length === 1) {
    const p = points[0];
    if (!p) return false;
    return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b && segmentIntersectsRect(a.x, a.y, b.x, b.y, minX, minY, maxX, maxY)) return true;
  }
  return false;
}

function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function circleIntersectsRect(
  centerX: number,
  centerY: number,
  radius: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  const nearestX = Math.max(minX, Math.min(maxX, centerX));
  const nearestY = Math.max(minY, Math.min(maxY, centerY));
  const dx = centerX - nearestX;
  const dy = centerY - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy] as const;
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1] as const;
  let t0 = 0;
  let t1 = 1;

  for (let i = 0; i < 4; i++) {
    const pi = p[i]!;
    const qi = q[i]!;
    if (pi === 0) {
      if (qi < 0) return false;
    } else {
      const r = qi / pi;
      if (pi < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0 <= t1;
}

function rectPoints(minX: number, minY: number, maxX: number, maxY: number): Point[] {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function diamondPoints(shape: { centerX: number; centerY: number; width: number; height: number }): Point[] {
  const hw = shape.width / 2;
  const hh = shape.height / 2;
  return [
    { x: shape.centerX, y: shape.centerY - hh },
    { x: shape.centerX + hw, y: shape.centerY },
    { x: shape.centerX, y: shape.centerY + hh },
    { x: shape.centerX - hw, y: shape.centerY },
  ];
}

function polygonsOverlap(a: Point[], b: Point[]): boolean {
  return !isSeparated(a, b) && !isSeparated(b, a);
}

function isSeparated(a: Point[], b: Point[]): boolean {
  const count = a.length;
  for (let i = 0; i < count; i++) {
    const p1 = a[i];
    const p2 = a[(i + 1) % count];
    if (!p1 || !p2) continue;
    const axisX = -(p2.y - p1.y);
    const axisY = p2.x - p1.x;

    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;

    for (const pt of a) {
      const d = pt.x * axisX + pt.y * axisY;
      if (d < minA) minA = d;
      if (d > maxA) maxA = d;
    }
    for (const pt of b) {
      const d = pt.x * axisX + pt.y * axisY;
      if (d < minB) minB = d;
      if (d > maxB) maxB = d;
    }
    if (maxA < minB || maxB < minA) return true;
  }
  return false;
}

function shapeIntersectsRect(shape: PersistedShape, minX: number, minY: number, maxX: number, maxY: number): boolean {
  switch (shape.type) {
    case "rect":
    case "text": {
      const bounds = getShapeBoundsStatic(shape);
      return aabbOverlap({ minX, minY, maxX, maxY }, { minX: bounds.x, minY: bounds.y, maxX: bounds.x + bounds.w, maxY: bounds.y + bounds.h });
    }
    case "circle":
      return circleIntersectsRect(shape.centerX, shape.centerY, shape.radius, minX, minY, maxX, maxY);
    case "diamond":
      return polygonsOverlap(rectPoints(minX, minY, maxX, maxY), diamondPoints(shape));
    case "pencil":
      return segmentIntersectsRect(shape.startX, shape.startY, shape.endX, shape.endY, minX, minY, maxX, maxY);
    case "freehand":
      return polylineIntersectsRect(shape.points, minX, minY, maxX, maxY);
  }
}

function textShapeBounds(shape: { x: number; y: number; text: string; fontSize: number }): { x: number; y: number; w: number; h: number } {
  const lines = shape.text.split("\n");
  const maxLength = lines.reduce((max, line) => Math.max(max, line.length), 0);
  return { x: shape.x, y: shape.y - shape.fontSize, w: maxLength * shape.fontSize * 0.6, h: lines.length * shape.fontSize * 1.2 };
}

function getShapeBoundsStatic(shape: Extract<PersistedShape, { type: "rect" } | { type: "text" }>): { x: number; y: number; w: number; h: number } {
  if (shape.type === "text") {
    return textShapeBounds(shape);
  }
  return {
    x: Math.min(shape.x, shape.x + shape.width),
    y: Math.min(shape.y, shape.y + shape.height),
    w: Math.abs(shape.width),
    h: Math.abs(shape.height),
  };
}

export { PRESET_COLORS };