import "@repo/backend-common/env";
import { createServer } from "node:http";
import { getContainer } from "./application/container.js";
import { createApp } from "./app.js";
import { createWsServer, dbPersistence } from "./infrastructure/websocket/index.js";

async function main() {
  const container = await getContainer();
  const app = createApp(container);
  const server = createServer(app);

  await createWsServer({ server, persistence: dbPersistence() });

  const PORT = process.env.PORT || process.env.HTTP_PORT || 3008;
  server.listen(PORT, () => {
    console.log(`HTTP + WebSocket backend running on port ${PORT}`);
  });
}

main().catch(console.error);