/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { resolve } from "path";
import { defineConfig } from "vite";
import Vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

const isDevEnv = process.env.NODE_ENV === "development";
const isWebBuild = !!process.env.VITE_WEB;

export default defineConfig(() => {
  return {
    resolve: {
      extensions: [".mjs", ".js", ".ts", ".less", ".vue", ".json", ".scss"],
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    base: isWebBuild ? "/MIDI-JAR-NEW/" : "./",
    clearScreen: false,
    server: {
      port: 5173,
      strictPort: true,
      watch: {
        ignored: ["**/src-tauri/target/**"],
        usePolling: true,
      },
    },
    build: {
      sourcemap: isDevEnv,
      minify: true,
      outDir: resolve("./dist"),
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        input: resolve(import.meta.dirname, "index.html"),
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
              if (/node_modules\/smplr\//.test(id)) return "smplr";
            }
          },
        },
      },
    },
    plugins: [Vue(), tailwindcss()],
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
      include: ["src/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
      exclude: ["node_modules", "dist"],
      server: {
        deps: {
          inline: ["tone"],
        },
      },
    },
  };
});
