import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": import.meta.dirname + "/src" } },
  build: {
    // Everything is inlined into a handful of files; the hub serves the
    // directory as static assets, so nothing here depends on a build machine.
    target: "es2022",
    chunkSizeWarningLimit: 700,
  },
  // A theme reads public data only, so any hub with its status page open can
  // serve as the source: MONITOR_HUB=https://hub.example.com npm run dev.
  server: {
    // Editors may briefly truncate a file before writing its new contents.
    watch: { awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 } },
    proxy: { "/api": { target: process.env.MONITOR_HUB || "http://127.0.0.1:9911", changeOrigin: true, ws: true } },
  },
})
