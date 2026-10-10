import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    setupFiles: ["tests/motion-setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
