/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { resolve, basename } from "path";
import { defineConfig, type Plugin } from "vite";
import Vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

const isDevEnv = process.env.NODE_ENV === "development";
const isWebBuild = !!process.env.VITE_WEB;

/**
 * Vite plugin that builds the AudioWorklet processor as a separate standalone JS bundle.
 * AudioWorklet requires a separate file loaded via audioWorklet.addModule().
 * This plugin compiles src/audio/modal-dsp/ModalSynthProcessor.ts (and all its
 * DSP dependencies) into a single self-contained JS file in public/.
 */
function audioWorkletBuild(): Plugin {
  const workletEntry = resolve(__dirname, "src/audio/modal-dsp/ModalSynthProcessor.ts");
  const workletOutFile = "modal-synth-processor.js";
  const publicWorkletPath = resolve(__dirname, "public", workletOutFile);

  let config: import("vite").ResolvedConfig;

  /** Compile the AudioWorklet processor to a standalone JS string */
  async function compileWorklet(minify = false): Promise<string> {
    const fs = await import("fs");
    const tmpDir = resolve(__dirname, "node_modules/.tmp-worklet");
    // Clean and rebuild to temp dir
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });

    const { build } = await import("vite");
    await build({
      configFile: false,
      logLevel: "warn",
      build: {
        emptyOutDir: true,
        outDir: tmpDir,
        lib: {
          entry: workletEntry,
          formats: ["iife"],
          name: "ModalSynthProcessor",
          fileName: () => workletOutFile,
        },
        rollupOptions: {
          output: { inlineDynamicImports: true },
        },
        minify,
        sourcemap: false,
      },
    });

    const outPath = resolve(tmpDir, workletOutFile);
    if (!fs.existsSync(outPath)) {
      throw new Error(`AudioWorklet build output not found at ${outPath}`);
    }
    return fs.readFileSync(outPath, "utf-8");
  }

  return {
    name: "audio-worklet-build",
    enforce: "post",

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    /**
     * Dev mode: compile the worklet to public/ on startup so Vite's static
     * file serving can serve it. We also watch source files and recompile
     * on change.
     */
    async buildStart() {
      if (config.command === "serve") {
        const fs = await import("fs");
        try {
          const code = await compileWorklet(false);
          fs.writeFileSync(publicWorkletPath, code, "utf-8");
          console.log("[audio-worklet-build] Compiled worklet to public/");
        } catch (err) {
          console.error("[audio-worklet-build] Dev compilation failed:", err);
        }
      }
    },

    /** Watch modal-dsp source files for changes in dev mode */
    handleHotUpdate({ file, server }) {
      if (file.includes("modal-dsp")) {
        compileWorklet(false).then((code) => {
          import("fs").then((fs) => {
            fs.writeFileSync(publicWorkletPath, code, "utf-8");
            console.log("[audio-worklet-build] Recompiled worklet (HMR)");
          });
        }).catch((err) => {
          console.error("[audio-worklet-build] HMR recompilation failed:", err);
        });
      }
    },

    /** Production build: compile worklet alongside the main build */
    async writeBundle() {
      const { build } = await import("vite");
      await build({
        configFile: false,
        logLevel: "warn",
        build: {
          emptyOutDir: false,
          outDir: resolve(config.build.outDir),
          lib: {
            entry: workletEntry,
            formats: ["iife"],
            name: "ModalSynthProcessor",
            fileName: () => workletOutFile,
          },
          rollupOptions: {
            output: {
              // No code splitting – everything in one file
              inlineDynamicImports: true,
            },
          },
          minify: config.build.minify,
          sourcemap: config.build.sourcemap,
        },
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
    plugins: [Vue(), tailwindcss(), audioWorkletBuild()],
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
