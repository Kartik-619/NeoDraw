import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@repo/shared-types": path.resolve(__dirname, "../packages/shared-types/src"),
      "@repo/db": path.resolve(__dirname, "../packages/db/src"),
      "@repo/common": path.resolve(__dirname, "../packages/common/src"),
      "@repo/backend-common": path.resolve(__dirname, "../packages/backand-common/src"),
    },
  },
  test: {
    globals: true,
  },
});
