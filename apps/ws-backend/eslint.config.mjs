import { config } from "@repo/eslint-config";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  ...config,
];