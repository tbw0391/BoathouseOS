import { defineConfig } from "vitest/config";
import path from "node:path";

// Calendar and alert dates are worked out in the club's time zone.
process.env.TZ = "America/New_York";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // "server-only" throws outside Next's server build; tests run in Node.
      "server-only": path.resolve(__dirname, "tests/serverOnlyStub.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
