import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The frontend builds to frontend/dist, which wrangler.toml serves as
// Workers Static Assets with SPA fallback (see [assets] in wrangler.toml).
// The Tailwind v4 Vite plugin is REQUIRED: without it the build emits only
// the theme/base CSS and none of the utility classes the markup uses
// (h-16, max-w-md, flex, …), which left the live welcome screen unstyled —
// the logo rendered at its natural 1600px size and the layout overflowed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist" },
});
