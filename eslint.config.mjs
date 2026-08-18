import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The react-hooks plugin must be declared in the same config object that
    // enables its rules; eslint-config-next scopes its own declaration to
    // React file patterns, and this object is unscoped.
    plugins: { "react-hooks": reactHooks },
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
    // Stale git worktrees checked out inside the repo carry their own
    // node_modules; linting them means linting a different checkout with a
    // different toolchain.
    ".worktrees/**",
    // Generated Playwright artefacts — regenerated on every e2e run.
    "playwright-report/**",
    "test-results/**",
    // Vendored DuckDB-WASM worker bundles shipped as-is from upstream.
    "public/_dl/**",
  ]),
]);

export default eslintConfig;
