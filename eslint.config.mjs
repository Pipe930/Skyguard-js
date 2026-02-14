// @ts-check
import eslint from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    ignores: [
      "eslint.config.mjs",
      "package.json",
      "package-lock.json",
      "node_modules",
      "dist",
      "coverage",
      "jest.config.ts",
    ],
    extends: ["eslint-config-prettier"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
        projectService: true,
      },
      parser: tseslint.parser,
    },
    rules: {
      eqeqeq: ["error", "always"],
      "no-empty-function": "error",
      "no-trailing-spaces": "error",
      "object-curly-spacing": ["error", "always"],
      "arrow-spacing": "error",
      "no-console": "warn",
      "no-implicit-coercion": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-duplicate-enum-values": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/unbound-method": "off",
    },
  },
);
