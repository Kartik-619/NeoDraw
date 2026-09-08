import { reactConfig } from "@repo/eslint-config";

export default [
  { ignores: [".next/**", "dist/**", "node_modules/**", "next-env.d.ts"] },
  ...reactConfig,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];