import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest-setup.js"],
    include: ["src/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    coverage: {
      reporter: ["text", "lcov"],
      exclude: ["**/*.css", "src/env.d.ts"],
      thresholds: {
        lines: 85,
      },
    },
  },
});
