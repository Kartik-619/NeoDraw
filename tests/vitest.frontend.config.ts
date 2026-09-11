import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../apps/neodraw-frontend/src"),
      "@repo/shared-types": path.resolve(__dirname, "../packages/shared-types/src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["frontend/**/*.test.{ts,tsx}"],
    setupFiles: [path.resolve(__dirname, "./frontend/setup.tsx")],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});