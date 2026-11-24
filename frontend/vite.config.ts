import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The frontend builds to frontend/dist, which wrangler.toml serves as
// Workers Static Assets with SPA fallback (see [assets] in wrangler.toml).
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
});
