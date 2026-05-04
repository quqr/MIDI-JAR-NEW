import { fileURLToPath, URL } from "node:url";
import { resolve } from "path";
import { rmSync } from "fs";
import { defineConfig } from "vite";
import Vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron";

const isDevEnv = process.env.NODE_ENV === "development";

export default defineConfig(() => {
  if (process.env.NODE_ENV !== "development") {
    rmSync("dist", { recursive: true, force: true });
  }

  return {
    resolve: {
      extensions: [".mjs", ".js", ".ts", ".less", ".vue", ".json", ".scss"],
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    base: "./",
    clearScreen: false,
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
            }
          },
        },
      },
    },
    plugins: [
      Vue(),
      tailwindcss(),
      null,
      electron([
        {
          entry: "electron/main.ts",
          vite: {
            build: {
              outDir: "dist-electron",
              rollupOptions: {
                external: ["electron", "@julusian/midi"],
              },
            },
          },
        },
        {
          entry: "electron/preload.ts",
          onstart(args) {
            args.reload();
          },
          vite: {
            build: {
              outDir: "dist-electron",
              lib: {
                formats: ["cjs"],
              },
              rollupOptions: {
                external: ["electron"],
              },
            },
          },
        },
      ]),
    ],
  };
});
