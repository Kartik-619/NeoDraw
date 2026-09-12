import type { IncomingMessage, ServerResponse } from "node:http";
import type { Express } from "express";
import { getContainer } from "../src/application/container.js";
import { createApp } from "../src/app.js";

let app: Express | null = null;

export default async function vercelHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let current = app;
  if (!current) {
    const container = await getContainer();
    current = createApp(container);
    app = current;
  }
  current(req, res);
}