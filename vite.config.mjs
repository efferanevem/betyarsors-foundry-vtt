import { defineConfig } from "vite";
import { resolve } from "path";

// Optional bundling into dist/. Foundry loads src/ directly during development
// (see module.json), so this is only needed if you later switch to a bundled build.
export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/betyarsors.mjs"),
      formats: ["es"],
      fileName: () => "betyarsors.js"
    },
    outDir: "dist",
    emptyOutDir: true
  }
});
