import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Land Scout Pro must be served over HTTPS for browser Geolocation
// to work reliably on real devices (localhost is exempt for dev).
const BUILD_ID = new Date().toISOString();

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    {
      name: "emit-version",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({ build: BUILD_ID, plan: "PRO" })
        });
      }
    }
  ],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api/overpass-proxy": {
        target: "https://overpass-api.de",
        changeOrigin: true,
        rewrite: () => "/api/interpreter"
      }
    }
  },
  build: {
    target: "es2018",
    sourcemap: false
  }
});
