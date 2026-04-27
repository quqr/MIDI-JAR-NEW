import { fileURLToPath, URL } from "node:url";
import { resolve } from "path";
import { rmSync } from "fs";
import { defineConfig } from "vite";
import Vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

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
      minify: !isDevEnv,
      outDir: resolve("./dist"),
      rollupOptions: {
        input: resolve(__dirname, "index.html"),
      },
    },
    plugins: [Vue(), tailwindcss(), null],
  };
});
