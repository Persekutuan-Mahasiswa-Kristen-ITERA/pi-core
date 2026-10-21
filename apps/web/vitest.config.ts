import { defineConfig } from "vitest/config";

/**
 * The web app's unit tests.
 *
 * `jsdom` rather than `node`: the code under test is the browser half of the OIDC flow and the API
 * client, and both use `sessionStorage`, `crypto.subtle` and `window.location`. Testing them in node
 * would mean stubbing the very things that make them work.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    restoreMocks: true,
  },
});
