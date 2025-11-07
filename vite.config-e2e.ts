import { defineConfig } from 'vite';
import packagejson from './package.json';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        mapLoad: 'public/mapLoad.html',
        withUIEvents: 'public/withUIEvents.html',
        basic: 'public/basic.html',
        withModel: 'public/withModel.html',
        withAnimatedModel: 'public/withAnimatedModel.html',
      },
    },
  },
  root: './e2e',
});
