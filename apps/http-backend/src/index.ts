import "@repo/backend-common/env";
import { getContainer } from "./application/container";
import { createApp } from "./app";

async function main() {
  const container = await getContainer();
  const app = createApp(container);

  const PORT = process.env.PORT || process.env.HTTP_PORT || 3008;
  app.listen(PORT, () => {
    console.log(`HTTP backend running on port ${PORT}`);
  });
}

main().catch(console.error);