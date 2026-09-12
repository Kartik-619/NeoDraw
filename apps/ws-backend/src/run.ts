import "@repo/backend-common/env";
import { initializeDatabase } from "@repo/db";
import { createWsServer, dbPersistence } from "./index";

async function main(): Promise<void> {
  await initializeDatabase();

  const { server } = await createWsServer({ persistence: dbPersistence() });

  const PORT = process.env.PORT || process.env.WS_PORT || 8080;
  server.listen(PORT, () => {
    console.log(`WebSocket backend running on port ${PORT}`);
  });
}

main().catch(console.error);