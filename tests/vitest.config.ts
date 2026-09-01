import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    globals: true,
    root: __dirname
  },
  resolve: {
    alias: {
      "@repo/shared-types": path.resolve(__dirname, "../packages/shared-types/src/index.ts"),
      "@repo/common/types": path.resolve(__dirname, "../packages/common/src/types.ts"),
      "@repo/backend-common/config": path.resolve(__dirname, "../packages/backand-common/src/index.ts")
    }
  }
});
