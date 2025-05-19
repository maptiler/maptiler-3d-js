import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        mapLoad: 'public/mapLoad.html',
        basic: 'public/basic.html',
        withModel: 'public/withModel.html',
      },
    },
  },
    root: './e2e',
});
