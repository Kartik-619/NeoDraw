import type { PersistedShape } from "@repo/shared-types";

export type HistoryEntry =
  | { kind: "add"; shape: PersistedShape }
  | { kind: "update"; shapeId: string; before: PersistedShape; after: PersistedShape }
  | { kind: "delete"; shapes: PersistedShape[] };

export class OperationHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  push(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  popUndo(): HistoryEntry | null {
    return this.undoStack.pop() ?? null;
  }

  pushRedo(entry: HistoryEntry): void {
    this.redoStack.push(entry);
  }

  popRedo(): HistoryEntry | null {
    return this.redoStack.pop() ?? null;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export type { PersistedShape };