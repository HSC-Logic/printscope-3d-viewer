import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "/printscope-3d-viewer/",
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts" },
});
