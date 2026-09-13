// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Static output: every page is prerendered to ./dist and served as a free,
// unmetered Cloudflare static asset. Add @astrojs/cloudflare only when a route
// genuinely needs to run on the server (store checkout), and only for that route.
export default defineConfig({
  site: "https://madebyanirudha.in",
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  integrations: [mdx(), sitemap()],
  vite: { plugins: [tailwindcss()] },
});
