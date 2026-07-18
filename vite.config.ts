import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

function copyCesiumAssets(): Plugin {
  return {
    name: "copy-cesium-assets",
    closeBundle() {
      const cesiumSrc = path.resolve(import.meta.dirname, "node_modules", "cesium", "Build", "Cesium");
      const cesiumDest = path.resolve(import.meta.dirname, "dist", "public", "cesium");
      if (!fs.existsSync(cesiumSrc)) return;
      fs.rmSync(cesiumDest, { recursive: true, force: true });
      fs.mkdirSync(cesiumDest, { recursive: true });
      fs.cpSync(cesiumSrc, cesiumDest, { recursive: true });
    },
  };
}

const plugins = [react(), tailwindcss(), jsxLocPlugin(), copyCesiumAssets()];

export default defineConfig({
  plugins,
  define: {
    CESIUM_BASE_URL: JSON.stringify("/cesium/"),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname),
  publicDir: path.resolve(import.meta.dirname, "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
  },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
