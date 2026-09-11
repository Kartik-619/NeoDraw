import WebSocket from "ws";
import type { ServerShapeMessage } from "@repo/shared-types";

interface WaitEntry {
  type: ServerShapeMessage["type"];
  predicate: (m: ServerShapeMessage) => boolean;
  resolve: (m: ServerShapeMessage) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

export interface WsFixture {
  ws: WebSocket;
  messages: ServerShapeMessage[];
  waitFor(type: ServerShapeMessage["type"], predicate?: (m: ServerShapeMessage) => boolean): Promise<ServerShapeMessage>;
  send(data: object): void;
  close(): Promise<void>;
}

const DEFAULT_TIMEOUT = 5000;

export function openSocket(url: string, token: string, timeoutMs = DEFAULT_TIMEOUT): Promise<WsFixture> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${url}?token=${token}`);
    const messages: ServerShapeMessage[] = [];
    const waiters: WaitEntry[] = [];

    function drainWaiters(): void {
      for (let i = waiters.length - 1; i >= 0; i--) {
        const entry = waiters[i]!;
        const found = messages.find(
          (m) => m.type === entry.type && (entry.predicate ? entry.predicate(m) : true),
        );
        if (found) {
          waiters.splice(i, 1);
          clearTimeout(entry.timer);
          entry.resolve(found);
        }
      }
    }

    ws.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString()) as ServerShapeMessage;
        messages.push(parsed);
      } catch {
        return;
      }
      drainWaiters();
    });

    ws.on("error", (err) => {
      for (const entry of waiters.splice(0)) {
        clearTimeout(entry.timer);
        entry.reject(err);
      }
      reject(err);
    });

    ws.on("open", () => {
      resolve({
        ws,
        messages,
        waitFor(type, predicate) {
          const existing = messages.find(
            (m) => m.type === type && (predicate ? predicate(m) : true),
          );
          if (existing) return Promise.resolve(existing);
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              const idx = waiters.findIndex((w) => w.resolve === res);
              if (idx >= 0) waiters.splice(idx, 1);
              rej(new Error(`Timed out after ${timeoutMs}ms waiting for "${type}"`));
            }, timeoutMs);
            waiters.push({ type, predicate: predicate ?? (() => true), resolve: res, reject: rej, timer });
          });
        },
        send(data) {
          ws.send(JSON.stringify(data));
        },
        close() {
          return new Promise((res) => {
            if (ws.readyState === WebSocket.CLOSED) {
              res();
              return;
            }
            ws.once("close", () => res());
            ws.close();
          });
        },
      });
    });
  });
}

export async function waitForSocketsClose(
  fixtures: WsFixture[],
  timeoutMs = 2000,
): Promise<void> {
  await Promise.all(fixtures.map((f) => f.close()));
  void timeoutMs;
}