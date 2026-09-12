import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@repo/shared-types": path.resolve(__dirname, "../packages/shared-types/src"),
      "@repo/common": path.resolve(__dirname, "../packages/common/src"),
      "@repo/backend-common": path.resolve(__dirname, "../packages/backand-common/src"),
    },
  },
  test: {
    globals: true,
    include: [
      "unit/**/*.test.ts",
      "integration/**/*.test.ts",
      "ws/**/*.test.ts",
      "load/**/*.test.ts",
      "security/**/*.test.ts",
    ],
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5432/neodraw_test",
      JWT_SECRET: "neodraw-test-secret",
    },
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});