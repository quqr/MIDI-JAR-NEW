/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { resolve } from "path";
import { defineConfig } from "vite";
import Vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

const isDevEnv = process.env.NODE_ENV === "development";

export default defineConfig(() => {
  return {
    resolve: {
      extensions: [".mjs", ".js", ".ts", ".less", ".vue", ".json", ".scss"],
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    base: "./",
    clearScreen: false,
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      sourcemap: isDevEnv,
      minify: true,
      outDir: resolve("./dist"),
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        input: resolve(__dirname, "index.html"),
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (/node_modules\/(vue|vue-router|pinia)\//.test(id))
                return "vue";
              if (/node_modules\/(tonal|@tonaljs)\//.test(id)) return "tonal";
              if (/node_modules\/vexflow\//.test(id)) return "vexflow";
              if (/node_modules\/@vue-flow\//.test(id)) return "vueflow";
              if (/node_modules\/pixi\.js\//.test(id)) return "pixi";
              if (/node_modules\/tone\//.test(id)) return "tone";
            }
          },
        },
      },
    },
    plugins: [Vue(), tailwindcss()],
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
      exclude: ["node_modules", "dist"],
    },
  };
});
