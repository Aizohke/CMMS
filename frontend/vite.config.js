import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// PWA config supports the "installable, offline-tolerant" requirement from
// the Master Guideline Section 2.1. Offline data queuing (IndexedDB +
// background sync) is documented as a Phase 6 roadmap item and is not yet
// implemented in this prototype - see the specification document.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "L'Oreal EA Plant CMMS",
        short_name: "Plant CMMS",
        description: "Line Captain, Engineer, and Admin maintenance management app",
        theme_color: "#0A0A0A",
        background_color: "#0A0A0A",
        display: "standalone",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
