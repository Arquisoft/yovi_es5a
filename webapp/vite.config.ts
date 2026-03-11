import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest-setup.js"],
    include: ["src/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/test/e2e/**"
    ],
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
