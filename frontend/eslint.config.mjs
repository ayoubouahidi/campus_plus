import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Next.js 16 flat config (node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md):
// Next + React + React Hooks rules, Core Web Vitals rules as errors, and typescript-eslint rules.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);

export default eslintConfig;
