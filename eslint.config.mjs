import { createRequire } from "node:module";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const require = createRequire(import.meta.url);
const reactVersion = require("react/package.json").version;

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      // eslint-plugin-react's "detect" mode calls context.getFilename(),
      // removed in ESLint 10 — pin the version so detection never runs.
      react: { version: reactVersion },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "docs/design-system/ui_kits/**",
    "mcp-server/dist/**",
    "next-env.d.ts",
    // Git worktrees checked out under the repo root (each has its own lint).
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
