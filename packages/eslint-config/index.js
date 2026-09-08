import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export const config = tseslint.config(
  { ignores: ["dist/**"] },
  { extends: tseslint.configs.recommended },
);

export const reactConfig = tseslint.config(
  { ignores: ["dist/**"] },
  { extends: tseslint.configs.recommended },
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
    settings: {
      react: { version: "detect" },
    },
  },
);
