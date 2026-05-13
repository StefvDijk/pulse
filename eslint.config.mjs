import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Nested Next build artifacts (e.g. design-handoff project under pulse/)
    "**/.next/**",
    // Local-only user data dirs (not part of the app source)
    "files/**",
    "files lichaam/**",
    // Nested `pulse/` dir holds design-handoff + docs + reference copies of src,
    // none of which is the canonical build source for this app.
    "pulse/**",
  ]),
]);

export default eslintConfig;
