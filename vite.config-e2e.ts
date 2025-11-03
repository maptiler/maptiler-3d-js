import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        mapLoad: 'public/mapLoad.html',
        withUIEvents: 'public/withUIEvents.html',
        basic: 'public/basic.html',
        withModel: 'public/withModel.html',
        withAnimatedModel: 'public/withAnimatedModel.html',
        withPitchAndRoll: 'public/withPitchAndRoll.html',
      },
    },
  },
    root: './e2e',
});
