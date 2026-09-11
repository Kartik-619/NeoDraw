import { createWsServer, type WsServerDeps, type WsServerHandle } from "@repo/ws-backend/src/index";
import type { AddressInfo } from "net";

export interface TestWsServer {
  url: string;
  port: number;
  handle: WsServerHandle;
  close(): Promise<void>;
}

export async function startTestWsServer(deps: WsServerDeps): Promise<TestWsServer> {
  const handle = await createWsServer(deps);
  await new Promise<void>((resolve) => handle.server.listen(0, () => resolve()));
  const addr = handle.server.address() as AddressInfo;
  return {
    url: `ws://127.0.0.1:${addr.port}`,
    port: addr.port,
    handle,
    close() {
      return handle.close();
    },
  };
}

/** Authenticator used by most integration tests: ?token=value is the userId. */
export function queryTokenAuthenticate(req: { url?: string }): string | null {
  const url = new URL(req.url || "/", "http://localhost");
  return url.searchParams.get("token");
}