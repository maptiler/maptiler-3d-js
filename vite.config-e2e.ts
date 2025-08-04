import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        mapLoad: 'public/mapLoad.html',
        basic: 'public/basic.html',
        withModel: 'public/withModel.html',
        withAnimatedModel: 'public/withAnimatedModel.html',
      },
    },
  },
    root: './e2e',
});
