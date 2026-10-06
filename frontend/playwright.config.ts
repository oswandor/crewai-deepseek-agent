import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:3000", screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 5"] } },
  ],
  // Use the production server in E2E so dynamic client chunks and A2UI are
  // tested exactly as deployed (the dev HMR websocket is not needed here).
  webServer: { command: "npm run start", url: "http://127.0.0.1:3000", reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
