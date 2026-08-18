/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { resolve } from "path";
import { writeFileSync } from "node:fs";
import { defineConfig } from "vite";
import Vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

const isDevEnv = process.env.NODE_ENV === "development";
const isWebBuild = !!process.env.VITE_WEB;

/**
 * Dev-only helper for Tauri.
 *
 * When `npm run dev` runs as Tauri's `beforeDevCommand`, Vite may auto-switch
 * away from the configured port (5173) if it is already occupied. Tauri's
 * `devUrl` is a static string, so the webview would otherwise load the wrong
 * port. We capture the *resolved* port after the server starts and write it to
 * `src-tauri/dev-server-port`; the Rust side reads it and navigates there.
 */
function writeResolvedDevPort() {
  return {
    name: "write-resolved-dev-port",
    configureServer(server: any) {
      server.httpServer?.once("listening", () => {
        const addr = server.httpServer?.address();
        if (addr && typeof addr === "object") {
          const port = (addr as { port: number }).port;
          const target = fileURLToPath(
            new URL("./src-tauri/dev-server-port", import.meta.url),
          );
          try {
            writeFileSync(target, String(port), "utf-8");
            server.config.logger.info(
              `dev server resolved on port ${port} (written to src-tauri/dev-server-port for Tauri)`,
            );
          } catch (e) {
            server.config.logger.warn(`failed to write dev-server-port: ${e}`);
          }
        }
      });
    },
  };
}

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
      // 端口被占用时自动切换到下一个可用端口（如 5174、5175…）
      strictPort: false,
      watch: {
        ignored: ["**/src-tauri/target/**"],
        usePolling: true,
      },
    },
    preview: {
      port: 4173,
      // 同上：preview 端口被占用时也自动切换
      strictPort: false,
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
    plugins: [Vue(), tailwindcss(), writeResolvedDevPort()],
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
