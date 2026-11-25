import { resolve } from 'node:path';
import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';

const isProduction = process.env.NODE_ENV === "production";

// ES module build for the CDN, imported straight from a browser. Unlike the npm ES build, three.js is bundled.
// `@maptiler/sdk` stays a bare import, so the plugin uses the same SDK instance as the page:
// the page maps it to the SDK's own ES module bundle (`maptiler-sdk.min.mjs`) with an import map.

// In library mode, Vite leaves whitespace and comments in ES output to keep it tree-shakable by the consumer's bundler.
// This file is served as is, so it is fully minified instead, after Vite's own (partial) minification.
// The same browser target as Vite's build is used, so the minifier doesn't introduce newer syntax.
function minifyEsBundle(): Plugin {
  let target: string | string[] | undefined;
  return {
    name: 'minify-es-bundle',
    configResolved(config) {
      target = config.build.target || undefined;
    },
    renderChunk: {
      order: 'post',
      handler(code, chunk) {
        if (!isProduction) return null;
        return transformWithEsbuild(code, chunk.fileName, { minify: true, format: 'esm', sourcemap: true, target });
      },
    },
  }
}

export default defineConfig({
  mode: isProduction ? "production" : "development",
  build: {
    outDir: "build",
    // the UMD build writes to the same folder
    emptyOutDir: false,
    minify: isProduction,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/maptiler-3d.ts'),
      fileName: () => "maptiler-3d.min.mjs",
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        "@maptiler/sdk"
      ],
    },
  },
  plugins: [minifyEsBundle()],
});
