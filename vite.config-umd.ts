import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

const isProduction = process.env.NODE_ENV === "production";

const plugins = [
  glsl({compress: isProduction})
];


export default defineConfig({
  mode: isProduction ? "production" : "development",
  build: {
    outDir: "build",
    minify: isProduction,
    sourcemap: !isProduction,
    lib: {
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/maptiler-3d-models.ts'),
      name: 'maptiler3dmodels',
      // the proper extensions will be added
      fileName: (format, entryName) => `${entryName}.${format}.js`,
      formats: ['umd'],
    },
    
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: [
        "@maptiler/sdk"
      ],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          "@maptiler/sdk": "maptilersdk",
        },
      },
    },
  },
  plugins,
})