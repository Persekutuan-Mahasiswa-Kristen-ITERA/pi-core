/**
 * Shared build configuration for the PI-CORE monorepo.
 *
 * This package owns the base tsconfig, the ESLint flat config and the Prettier
 * config that every app and package extends, so the toolchain is defined once.
 */
export const CONFIG_PACKAGE = "@pi-core/config" as const;

/** Files that are generated and must never be linted or formatted. */
export const IGNORED_GLOBS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/.open-next/**",
  "**/.turbo/**",
] as const;
