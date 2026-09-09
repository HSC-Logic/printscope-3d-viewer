import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:4173/printscope-3d-viewer/", trace: "retain-on-failure" },
  webServer: { command: "npm run build && npm run preview -- --host 127.0.0.1", url: "http://127.0.0.1:4173/printscope-3d-viewer/", reuseExistingServer: true },
  projects: [
    { name: "mobile-320", use: { viewport: { width: 320, height: 568 } } },
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet-landscape", use: { viewport: { width: 1024, height: 768 } } },
    { name: "laptop", use: { viewport: { width: 1366, height: 768 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
});
