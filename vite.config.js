import { defineConfig } from "vite";

export default defineConfig({
  test: {
    environment: "node",
    coverage: { enabled: false }
  }
});
