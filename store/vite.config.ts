import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// One dev server for both halves: Vite serves the React app and the
// Cloudflare plugin runs worker/index.ts (the /api routes) in workerd with
// local D1 and R2, exactly as they run in production.
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: { port: 5180 },
});
