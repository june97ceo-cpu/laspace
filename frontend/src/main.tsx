// Cloudflare build entry: plain React root on #root (see frontend/index.html)
// with a standard TanStack QueryClient — no Muse SDK involved. The App
// renders its own .laspace-root element, and safe-area padding comes from
// the tailwindcss-safe-area utilities used in the markup (pt-safe …).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";

const queryClient = new QueryClient();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("missing #root element");
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
